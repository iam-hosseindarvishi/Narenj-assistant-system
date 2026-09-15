"""Layer 1: POS summaries <-> shaparak bank deposits, matched on date D+1."""
from dataclasses import dataclass, field
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.bank_transaction import BankTransaction
from app.models.pos import PosSummary
from app.models.reconciliation_link import ReconciliationLink
from app.services.jalali import jalali_add_days


@dataclass
class Layer1Match:
    pos_summary_id: int
    bank_tx_id: int
    amount: float
    match_type: str
    confidence: float
    note: str


@dataclass
class Layer1Result:
    matched: int
    pending: int
    unmatched: int
    matches: list[Layer1Match] = field(default_factory=list)


class Layer1Reconciler:
    def __init__(self, db: Session):
        self.db = db

    def reconcile(self) -> Layer1Result:
        summaries = self._unmatched_summaries()
        banks = self._unmatched_shaparak()

        matches: list[Layer1Match] = []
        used_banks: set[int] = set()
        used_summaries: set[int] = set()

        by_date: dict[str, list] = {}
        for s in summaries:
            by_date.setdefault(s.date_jalali, []).append(s)

        for pos_date, day_summaries in by_date.items():
            next_day = jalali_add_days(pos_date, 1)
            available = [b for b in banks if b.id not in used_banks and b.date_jalali == next_day]

            # 1:1 by amount
            for s in day_summaries:
                if s.id in used_summaries:
                    continue
                amount = float(s.amount)
                bank = next((b for b in available if b.id not in used_banks and float(b.deposit_amount) == amount), None)
                if bank:
                    matches.append(Layer1Match(
                        pos_summary_id=s.id, bank_tx_id=bank.id, amount=amount,
                        match_type="auto", confidence=1.0,
                        note=f"1:1 match: POS {s.branch_id} @ {pos_date} amount={amount} == Bank @ {next_day}",
                    ))
                    used_banks.add(bank.id)
                    used_summaries.add(s.id)

            # Aggregated: sum of remaining POS == one bank deposit
            remaining = [s for s in day_summaries if s.id not in used_summaries]
            if len(remaining) >= 2:
                total = sum(float(s.amount) for s in remaining)
                bank = next((b for b in available if b.id not in used_banks and float(b.deposit_amount) == total), None)
                if bank:
                    for s in remaining:
                        matches.append(Layer1Match(
                            pos_summary_id=s.id, bank_tx_id=bank.id, amount=float(s.amount),
                            match_type="auto", confidence=0.9,
                            note=f"Aggregated match: POS {s.branch_id} @ {pos_date} part of sum {total} == Bank @ {next_day}",
                        ))
                        used_summaries.add(s.id)
                    used_banks.add(bank.id)

        self._write(matches)

        return Layer1Result(
            matched=len(matches),
            pending=len(summaries) - len(used_summaries),
            unmatched=len(banks) - len(used_banks),
            matches=matches,
        )

    def _unmatched_summaries(self) -> list[PosSummary]:
        return list(self.db.execute(
            select(PosSummary).where(PosSummary.status == "unmatched")
        ).scalars())

    def _unmatched_shaparak(self) -> list[BankTransaction]:
        return list(self.db.execute(
            select(BankTransaction).where(BankTransaction.status == "unmatched", BankTransaction.tx_type == "shaparak")
        ).scalars())

    def _write(self, matches: list[Layer1Match]) -> None:
        for m in matches:
            self.db.add(ReconciliationLink(
                layer=1, bank_tx_id=m.bank_tx_id, pos_summary_id=m.pos_summary_id,
                match_type=m.match_type, confidence=Decimal(str(m.confidence)), note=m.note,
            ))
            self.db.execute(
                PosSummary.__table__.update().where(PosSummary.id == m.pos_summary_id).values(status="matched")
            )
            self.db.execute(
                BankTransaction.__table__.update().where(BankTransaction.id == m.bank_tx_id).values(status="matched")
            )
        self.db.commit()
