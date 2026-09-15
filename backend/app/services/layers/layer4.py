"""Layer 4: individual POS transactions <-> accounting entries."""
import re
from dataclasses import dataclass, field
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.accounting_entry import AccountingEntry
from app.models.audit_log import AuditLog
from app.models.pos import PosTransaction
from app.models.reconciliation_link import ReconciliationLink


@dataclass
class Layer4Link:
    pos_tx_id: int
    accounting_id: int
    match_type: str
    confidence: float
    note: str


@dataclass
class Layer4Result:
    ok: bool = True
    error: str | None = None
    matched: int = 0
    pending: int = 0
    unmatched: int = 0
    links: list[Layer4Link] = field(default_factory=list)


class Layer4Reconciler:
    def __init__(self, db: Session):
        self.db = db

    def reconcile(self) -> Layer4Result:
        try:
            pos_rows = list(self.db.execute(
                select(PosTransaction).where(PosTransaction.status == "unmatched")
            ).scalars())
            acc_rows = list(self.db.execute(
                select(AccountingEntry).where(AccountingEntry.status == "unmatched")
            ).scalars())

            links: list[Layer4Link] = []
            used_acc: set[int] = set()
            matched_pos: set[int] = set()
            matched = 0

            # Pass 1: aggregated entries (سرجمع) by branch + date sum
            for entry in acc_rows:
                if entry.id in used_acc or not self._is_aggregate(entry.description or ""):
                    continue
                entry_amount = float(entry.debit) if float(entry.debit) > 0 else float(entry.credit)
                if entry_amount <= 0:
                    continue
                branch_filter = self._aggregate_branch(entry.description or "")
                candidates = [
                    p for p in pos_rows
                    if p.id not in matched_pos
                    and p.date_jalali == entry.date_jalali
                    and (not branch_filter or branch_filter in (p.branch_name or ""))
                ]
                total = sum(float(p.amount) for p in candidates)
                if not candidates or abs(total - entry_amount) >= 0.01:
                    continue
                for p in candidates:
                    links.append(self._persist(p.id, entry.id, "auto", 0.9,
                                               "Layer 4 aggregated POS transaction match"))
                    matched_pos.add(p.id)
                    matched += 1
                used_acc.add(entry.id)

            # Pass 2: individual by havale ref last-6 + card last-4
            for p in pos_rows:
                if p.id in matched_pos:
                    continue
                last6 = self._last6(p.ref_number)
                last4 = self._card_last4(p.card_number_masked or "")
                candidates = [
                    a for a in acc_rows
                    if a.id not in used_acc
                    and self._matches_description(a.description or "", last6, last4)
                ]
                if len(candidates) == 1:
                    links.append(self._persist(p.id, candidates[0].id, "auto", 1.0,
                                               "Layer 4 individual POS transaction match"))
                    used_acc.add(candidates[0].id)
                    matched_pos.add(p.id)
                    matched += 1

            self.db.commit()
            return Layer4Result(matched=matched, pending=0,
                                unmatched=len(pos_rows) - matched, links=links)
        except Exception as exc:
            self.db.rollback()
            return Layer4Result(ok=False, error=str(exc))

    def _persist(self, pos_id: int, acc_id: int, match_type: str, confidence: float, note: str) -> Layer4Link:
        self.db.add(ReconciliationLink(
            layer=4, pos_tx_id=pos_id, accounting_id=acc_id,
            match_type=match_type, confidence=Decimal(str(confidence)), note=note,
        ))
        self.db.execute(
            PosTransaction.__table__.update().where(PosTransaction.id == pos_id).values(status="matched")
        )
        self.db.execute(
            AccountingEntry.__table__.update().where(AccountingEntry.id == acc_id).values(status="matched")
        )
        self.db.add(AuditLog(
            action="match", entity_type="pos_transactions", entity_id=pos_id,
            new_value=f'{{"accountingId": {acc_id}, "layer": 4}}',
        ))
        return Layer4Link(pos_tx_id=pos_id, accounting_id=acc_id, match_type=match_type,
                          confidence=confidence, note=note)

    @staticmethod
    def _last6(ref_number: str) -> str:
        return "".join(re.findall(r"\d", ref_number or ""))[-6:]

    @staticmethod
    def _card_last4(card_number: str) -> str:
        return re.sub(r"\D", "", (card_number or "").replace("*", ""))[-4:]

    @staticmethod
    def _matches_description(description: str, last6: str, last4: str) -> bool:
        has_havale = len(last6) >= 4 and f"حواله ({last6})" in description
        has_card = len(last4) >= 4 and f"ک {last4}" in description
        return has_havale and has_card

    @staticmethod
    def _is_aggregate(description: str) -> bool:
        return bool(re.search(r"سرجمع|تجمیع|تجمیعی|جمع\s*کل", description))

    @staticmethod
    def _aggregate_branch(description: str) -> str | None:
        match = re.search(r"سرجمع\s+(نارنج\s+\S+)", description)
        return match.group(1) if match else None
