"""Layer 3: non-POS bank transactions <-> accounting entries.

Disambiguation order (per approved spec):
1. Exclude accounting descriptions containing نارنج.
2. Havale paren-group numbers: numbers inside (…) after حواله in the
   accounting description are searched in the bank text; exactly one
   candidate containing a number auto-matches (confidence 0.85). Shared
   numbers are ambiguous and fall through to suggestions.
3. Legacy havale trailing digits.
4. Check numbers.
5. Suggestion fallback (first candidate, confidence 0.6).
"""
import re
from dataclasses import dataclass, field
from decimal import Decimal

from sqlalchemy import exists, or_, and_, select
from sqlalchemy.orm import Session

from app.models.accounting_entry import AccountingEntry
from app.models.audit_log import AuditLog
from app.models.bank_transaction import BankTransaction
from app.models.reconciliation_link import ReconciliationLink


@dataclass
class Layer3Link:
    bank_tx_id: int
    accounting_id: int
    match_type: str
    confidence: float
    note: str


@dataclass
class Layer3Result:
    ok: bool = True
    error: str | None = None
    matched: int = 0
    pending: int = 0
    unmatched: int = 0
    links: list[Layer3Link] = field(default_factory=list)


class Layer3Reconciler:
    def __init__(self, db: Session):
        self.db = db

    def reconcile(self) -> Layer3Result:
        try:
            bank_rows = self._bank_candidates()
            acc_rows = self._accounting_candidates()

            links: list[Layer3Link] = []
            matched_acc: set[int] = set()
            matched = pending = unmatched = 0

            for bank in bank_rows:
                is_deposit = float(bank.deposit_amount or 0) > 0
                bank_amount = float(bank.deposit_amount if is_deposit else bank.withdrawal_amount or 0)

                candidates = [
                    a for a in acc_rows
                    if a.id not in matched_acc
                    and a.date_jalali == bank.date_jalali
                    and abs(float(a.debit if is_deposit else a.credit) - bank_amount) < 0.01
                ]

                if not candidates:
                    unmatched += 1
                    continue

                if len(candidates) == 1:
                    acc = candidates[0]
                    matched_acc.add(acc.id)
                    matched += 1
                    links.append(self._commit_match(
                        bank.id, acc.id, "auto", 1.0,
                        f"Layer 3 1:1 match on date {bank.date_jalali} and amount {bank_amount}",
                    ))
                    continue

                # Sub-rule a: exclude نارنج
                non_narenj = [a for a in candidates if "نارنج" not in (a.description or "")]

                resolved: AccountingEntry | None = None
                confidence = 1.0
                suggested = False

                # Sub-rule b: havale paren-group numbers
                bank_text = " ".join(
                    t for t in (bank.reference, bank.deposit_ref, bank.description) if t
                )
                havale_hits = [
                    a for a in non_narenj
                    if any(self._bank_text_contains_number(bank_text, num)
                           for num in self._havale_paren_numbers(a.description))
                ]
                if len(havale_hits) == 1:
                    resolved = havale_hits[0]
                    confidence = 0.85
                havale_ambiguous = len(havale_hits) > 1

                # Sub-rule b2: legacy havale trailing digits (only if unambiguous)
                if not resolved and not havale_ambiguous:
                    bank_ref = self._bank_ref_digits(bank)
                    for a in non_narenj:
                        acc_havale = self._legacy_havale_digits(a.description)
                        if acc_havale and bank_ref and len(acc_havale) >= 4 and len(bank_ref) >= 4 \
                                and (bank_ref.endswith(acc_havale) or acc_havale.endswith(bank_ref)):
                            resolved = a
                            confidence = 0.85
                            break

                # Sub-rule c: check numbers
                if not resolved and (bank.tx_type == "check" or (bank.description and re.search(r"چک|چکاوک", bank.description))):
                    bank_check = self._check_number(bank.description)
                    if bank_check:
                        for a in non_narenj:
                            acc_check = self._check_number(a.description)
                            if acc_check and (acc_check == bank_check or acc_check.endswith(bank_check) or bank_check.endswith(acc_check)):
                                resolved = a
                                confidence = 0.9
                                break

                # Sub-rule d: suggestion fallback
                if not resolved and non_narenj:
                    resolved = non_narenj[0]
                    confidence = 0.6
                    suggested = True

                if resolved and not suggested:
                    matched_acc.add(resolved.id)
                    matched += 1
                    links.append(self._commit_match(
                        bank.id, resolved.id, "auto", confidence,
                        f"Layer 3 disambiguated match (confidence {confidence})",
                    ))
                elif resolved:
                    pending += 1
                    link = self._add_link(bank.id, resolved.id, "suggested", confidence,
                                          "Layer 3 suggestion for user review")
                    links.append(link)
                else:
                    unmatched += 1

            self.db.commit()
            return Layer3Result(matched=matched, pending=pending, unmatched=unmatched, links=links)
        except Exception as exc:
            self.db.rollback()
            return Layer3Result(ok=False, error=str(exc))

    # -- persistence ----------------------------------------------------------
    def _add_link(self, bank_id: int, acc_id: int, match_type: str, confidence: float, note: str) -> Layer3Link:
        link = ReconciliationLink(
            layer=3, bank_tx_id=bank_id, accounting_id=acc_id,
            match_type=match_type, confidence=Decimal(str(confidence)), note=note,
        )
        self.db.add(link)
        return Layer3Link(bank_tx_id=bank_id, accounting_id=acc_id, match_type=match_type,
                          confidence=confidence, note=note)

    def _commit_match(self, bank_id: int, acc_id: int, match_type: str, confidence: float, note: str) -> Layer3Link:
        link = self._add_link(bank_id, acc_id, match_type, confidence, note)
        self.db.execute(
            BankTransaction.__table__.update().where(BankTransaction.id == bank_id).values(status="matched")
        )
        self.db.execute(
            AccountingEntry.__table__.update().where(AccountingEntry.id == acc_id).values(status="matched")
        )
        self.db.add(AuditLog(
            action="match", entity_type="bank_transactions", entity_id=bank_id,
            new_value=f'{{"accountingId": {acc_id}, "matchType": "auto", "layer": 3, "confidence": {confidence}}}',
        ))
        return link

    # -- candidate queries ------------------------------------------------------
    def _bank_candidates(self) -> list[BankTransaction]:
        no_link = ~exists(
            select(1).where(ReconciliationLink.bank_tx_id == BankTransaction.id)
        )
        fee_entry = select(AccountingEntry).where(
            AccountingEntry.entry_type == "fee",
            AccountingEntry.date_jalali == BankTransaction.date_jalali,
            or_(
                and_(BankTransaction.deposit_amount > 0,
                     AccountingEntry.credit == BankTransaction.deposit_amount),
                and_(BankTransaction.withdrawal_amount > 0,
                     AccountingEntry.debit == BankTransaction.withdrawal_amount),
            ),
        )
        keyword_excluded = or_(
            BankTransaction.description.is_(None),
            and_(
                BankTransaction.description.notlike("%واريزپايا%"),
                BankTransaction.description.notlike("%کارمزد%"),
                BankTransaction.description.notlike("%ثبت چک%"),
            ),
        )
        rows = list(self.db.execute(
            select(BankTransaction).where(
                BankTransaction.status == "unmatched",
                BankTransaction.tx_type.in_(("transfer", "check", "other")),
                keyword_excluded,
                no_link,
                ~exists(fee_entry),
            ).order_by(BankTransaction.date_jalali)
        ).scalars())
        return rows

    def _accounting_candidates(self) -> list[AccountingEntry]:
        return list(self.db.execute(
            select(AccountingEntry).where(AccountingEntry.status == "unmatched").order_by(AccountingEntry.date_jalali)
        ).scalars())

    # -- extraction helpers -----------------------------------------------------
    @staticmethod
    def _havale_paren_numbers(description: str | None) -> list[str]:
        """All numbers in the paren group after حواله.

        Handles 'حواله (803392)', 'حواله پرداختی (061809)', and
        multi-number groups 'حواله (0079347 8963437 89634370157)'.
        Requires a literal '(' so 'حواله شماره 061809' is not captured.
        """
        if not description:
            return []
        match = re.search(r"حواله[^()]*\(([^)]+)\)", description)
        if not match:
            return []
        return [p for p in match.group(1).split() if p]

    @staticmethod
    def _bank_text_contains_number(bank_text: str, num: str) -> bool:
        """True when num appears at the end of a digit run in bank_text,
        so '8963437' does not prefix-match '89634370157' but a real
        suffix like '267303' inside '140506030162267303' does."""
        if not num or not bank_text:
            return False
        return re.search(re.escape(num) + r"(?![0-9])", bank_text) is not None

    @staticmethod
    def _legacy_havale_digits(description: str | None) -> str | None:
        if not description:
            return None
        match = re.search(r"حواله\s*\(?\s*([0-9]+)\s*\)?", description)
        return match.group(1) if match else None

    @staticmethod
    def _bank_ref_digits(bank: BankTransaction) -> str | None:
        for item in (bank.reference, bank.deposit_ref, bank.description):
            if not item:
                continue
            match = re.search(r"([0-9]{4,})", item)
            if match:
                return match.group(1)
        return None

    @staticmethod
    def _check_number(description: str | None) -> str | None:
        if not description:
            return None
        match = re.search(r"(?:چک|چکاوک|ثبت چک|شماره چک)\s*\(?([0-9]+)\)?", description)
        if match:
            return match.group(1)
        match = re.search(r"[0-9]{5,}", description)
        return match.group(0) if match else None
