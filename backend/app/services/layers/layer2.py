"""Layer 2: bank fees <-> accounting fees by amount+date, plus daily aggregation."""
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.bank_transaction import BankTransaction
from app.models.accounting_entry import AccountingEntry
from app.models.fee_aggregation import FeeAggregation
from app.models.reconciliation_link import ReconciliationLink


@dataclass
class FeeAggregationRow:
    date_jalali: str
    total_amount: float
    linked_count: int
    unlinked_count: int
    registered: bool


@dataclass
class Layer2Result:
    matched: int
    aggregated: int
    fees: list[FeeAggregationRow] = field(default_factory=list)


class Layer2Reconciler:
    def __init__(self, db: Session):
        self.db = db

    def reconcile(self) -> Layer2Result:
        bank_fees = self._bank_fees()
        accounting_fees = self._accounting_fees()

        used_acc: set[int] = set()
        matched = 0

        for fee in bank_fees:
            if fee.status == "matched":
                continue
            amount = float(fee.deposit_amount or 0) + float(fee.withdrawal_amount or 0)
            # TS semantics: deposit OR withdrawal equals fee amount on the same day
            acc = next(
                (
                    a for a in accounting_fees
                    if a.status == "unmatched" and a.id not in used_acc
                    and a.date_jalali == fee.date_jalali
                    and (float(a.debit) == amount or float(a.credit) == amount)
                ),
                None,
            )
            if acc:
                self.db.add(ReconciliationLink(
                    layer=2, bank_tx_id=fee.id, accounting_id=acc.id,
                    match_type="auto", confidence=Decimal("1.0"), note="Fee matched by amount",
                ))
                fee.status = "matched"
                acc.status = "matched"
                used_acc.add(acc.id)
                matched += 1
        self.db.commit()

        unmatched_fees = [f for f in bank_fees if f.status != "matched"]
        aggregations = self._aggregate(unmatched_fees, bank_fees)
        self._write_aggregations(aggregations)

        # Mark aggregated leftovers matched so they don't leak into manual view
        for fee in unmatched_fees:
            fee.status = "matched"
        self.db.commit()

        return Layer2Result(matched=matched, aggregated=len(aggregations), fees=aggregations)

    def register_fees(self, date_jalali: str, registered: bool, user_id: int | None = None) -> None:
        agg = self.db.execute(
            select(FeeAggregation).where(FeeAggregation.date_jalali == date_jalali)
        ).scalar_one_or_none()
        if not agg:
            return
        agg.registered = registered
        agg.registered_by = user_id if registered else None
        agg.registered_at = datetime.now(timezone.utc) if registered else None
        self.db.add(AuditLog(
            user_id=user_id,
            action="fee-register" if registered else "fee-unregister",
            entity_type="fee_aggregations",
            entity_id=None,
            new_value=f'{{"dateJalali": "{date_jalali}", "registered": {str(registered).lower()}}}',
        ))
        self.db.commit()

    def _bank_fees(self) -> list[BankTransaction]:
        return list(self.db.execute(
            select(BankTransaction).where(
                (BankTransaction.tx_type == "fee")
                | (BankTransaction.description.like("%واريزپايا%") & BankTransaction.description.notlike("%شرح:%"))
                | (BankTransaction.description.like("%کارمزد%"))
                | (BankTransaction.description.like("%ثبت چک%"))
            )
        ).scalars())

    def _accounting_fees(self) -> list[AccountingEntry]:
        return list(self.db.execute(
            select(AccountingEntry).where(AccountingEntry.entry_type == "fee")
        ).scalars())

    def _aggregate(self, fees: list[BankTransaction], all_fees: list[BankTransaction]) -> list[FeeAggregationRow]:
        by_date: dict[str, float] = {str(f.date_jalali): 0.0 for f in all_fees}
        for f in fees:
            by_date.setdefault(str(f.date_jalali), 0.0)
            by_date[str(f.date_jalali)] += (float(f.deposit_amount or 0) + float(f.withdrawal_amount or 0))
        return [
            FeeAggregationRow(
                date_jalali=d,
                total_amount=total,
                linked_count=sum(1 for f in all_fees if str(f.date_jalali) == d and f.status == "matched"),
                unlinked_count=sum(1 for f in fees if str(f.date_jalali) == d),
                registered=False,
            )
            for d, total in sorted(by_date.items())
        ]

    def _write_aggregations(self, aggregations: list[FeeAggregationRow]) -> None:
        dates = {a.date_jalali for a in aggregations}
        existing = self.db.execute(select(FeeAggregation)).scalars().all()
        for row in existing:
            if row.date_jalali not in dates:
                row.total_amount = Decimal("0")
        for agg in aggregations:
            row = next((r for r in existing if r.date_jalali == agg.date_jalali), None)
            if row:
                row.total_amount = Decimal(str(agg.total_amount))
            else:
                self.db.add(FeeAggregation(
                    date_jalali=agg.date_jalali,
                    total_amount=Decimal(str(agg.total_amount)),
                    registered=False,
                ))
        self.db.commit()
