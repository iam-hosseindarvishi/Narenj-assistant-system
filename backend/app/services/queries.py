"""Read queries powering the listing endpoints (port of QueryHelper)."""
from dataclasses import dataclass, field
from decimal import Decimal

from sqlalchemy import select, func, text
from sqlalchemy.orm import Session

from app.models.accounting_entry import AccountingEntry
from app.models.audit_log import AuditLog
from app.models.bank_transaction import BankTransaction
from app.models.fee_aggregation import FeeAggregation
from app.models.pos import PosSummary, PosTransaction
from app.models.reconciliation_link import ReconciliationLink
from app.models.uploaded_file import UploadedFile
from app.services.jalali import jalali_add_days, jalali_days_between, today_jalali


@dataclass
class StatusCounts:
    matched: int = 0
    pending: int = 0
    unmatched: int = 0
    manual: int = 0
    total: int = 0


@dataclass
class DashboardStats:
    layer1: StatusCounts = field(default_factory=StatusCounts)
    layer2: StatusCounts = field(default_factory=StatusCounts)
    layer3: StatusCounts = field(default_factory=StatusCounts)
    layer4: StatusCounts = field(default_factory=StatusCounts)
    unregistered_fee_total: float = 0.0
    date_fee_total: float | None = None


def _counts_by_status(db: Session, model, extra_where=None) -> StatusCounts:
    stmt = select(model.status, func.count()).group_by(model.status)
    if extra_where is not None:
        stmt = stmt.where(extra_where)
    by_status = {status: int(count) for status, count in db.execute(stmt).all()}
    matched = by_status.get("matched", 0)
    pending = by_status.get("pending", 0)
    unmatched = by_status.get("unmatched", 0)
    manual = by_status.get("manual", 0)
    return StatusCounts(matched=matched, pending=pending, unmatched=unmatched,
                        manual=manual, total=matched + pending + unmatched + manual)


class QueryHelper:
    def __init__(self, db: Session):
        self.db = db

    def list_layer1(self) -> list[dict]:
        rows = self.db.execute(
            select(
                PosSummary, ReconciliationLink, BankTransaction
            ).join(
                ReconciliationLink, (ReconciliationLink.pos_summary_id == PosSummary.id) & (ReconciliationLink.layer == 1), isouter=True
            ).join(
                BankTransaction, BankTransaction.id == ReconciliationLink.bank_tx_id, isouter=True
            ).order_by(PosSummary.date_jalali, PosSummary.branch_id)
        ).all()
        latest_bank = self.db.execute(
            select(func.max(BankTransaction.date_jalali))
        ).scalar()
        out = []
        for ps, link, bt in rows:
            bank_amount = float(bt.deposit_amount) if bt else None
            days_waiting = None
            if ps.status != "matched":
                days_waiting = jalali_days_between(
                    jalali_add_days(ps.date_jalali, 1),
                    latest_bank or today_jalali(),
                )
            out.append({
                "id": ps.id,
                "dateJalali": ps.date_jalali,
                "branchId": ps.branch_id,
                "branchName": ps.branch_name,
                "terminalId": ps.terminal_id,
                "txCount": ps.tx_count,
                "posAmount": float(ps.amount),
                "bankAmount": bank_amount,
                "diff": (float(ps.amount) - bank_amount) if bank_amount is not None else None,
                "status": ps.status,
                "matchType": link.match_type if link else None,
                "confidence": float(link.confidence) if link else None,
                "daysWaiting": days_waiting,
            })
        return out

    def list_layer2(self) -> list[dict]:
        aggregations = list(self.db.execute(select(FeeAggregation).order_by(FeeAggregation.date_jalali)).scalars())
        fees = list(self.db.execute(
            select(BankTransaction).where(BankTransaction.tx_type == "fee").order_by(BankTransaction.date_jalali, BankTransaction.id)
        ).scalars())
        dates = sorted({str(a.date_jalali) for a in aggregations} | {str(f.date_jalali) for f in fees})
        out = []
        for date in dates:
            agg = next((a for a in aggregations if str(a.date_jalali) == date), None)
            day_fees = [f for f in fees if str(f.date_jalali) == date]
            fee_rows = [
                {
                    "id": f.id,
                    "amount": float(f.deposit_amount or 0) + float(f.withdrawal_amount or 0),
                    "description": f.description or "",
                    "status": f.status,
                }
                for f in day_fees
            ]
            registered = bool(agg and agg.registered)
            fallback_total = sum(fr["amount"] for fr in fee_rows if fr["status"] != "matched")
            out.append({
                "dateJalali": date,
                "totalAmount": 0.0 if registered else (float(agg.total_amount) if agg else fallback_total),
                "linkedCount": sum(1 for fr in fee_rows if fr["status"] == "matched"),
                "unlinkedCount": 0 if registered else sum(1 for fr in fee_rows if fr["status"] != "matched"),
                "registered": registered,
                "registeredBy": agg.registered_by if agg else None,
                "registeredAt": str(agg.registered_at) if agg and agg.registered_at else None,
                "fees": fee_rows,
            })
        return out

    def list_layer3(self) -> list[dict]:
        rows = self.db.execute(text("""
            SELECT bt.id AS bank_tx_id, bt.date_jalali, bt.description AS bank_description, bt.status,
                   (COALESCE(bt.deposit_amount, 0) + COALESCE(bt.withdrawal_amount, 0)) AS amount,
                   ae.id AS accounting_id, ae.entry_id AS accounting_entry_id,
                   ae.description AS accounting_description,
                   ae.debit AS accounting_debit, ae.credit AS accounting_credit,
                   rl.id AS link_id, rl.match_type, rl.confidence
            FROM bank_transactions bt
            LEFT JOIN reconciliation_links rl ON rl.bank_tx_id = bt.id AND rl.layer = 3
            LEFT JOIN accounting_entries ae ON ae.id = rl.accounting_id
            WHERE bt.tx_type IN ('transfer', 'check', 'other')
              AND (bt.description IS NULL OR (
                bt.description NOT LIKE '%واريزپايا%'
                AND bt.description NOT LIKE '%کارمزد%'
                AND bt.description NOT LIKE '%ثبت چک%'
              ))
              AND NOT EXISTS (
                SELECT 1 FROM accounting_entries ae2
                WHERE ae2.entry_type = 'fee'
                  AND ae2.date_jalali = bt.date_jalali
                  AND (
                    (bt.deposit_amount > 0 AND ae2.credit = bt.deposit_amount)
                    OR (bt.withdrawal_amount > 0 AND ae2.debit = bt.withdrawal_amount)
                  )
              )
            ORDER BY bt.date_jalali, bt.id
        """)).mappings().all()
        return [
            {
                "bankTxId": r["bank_tx_id"],
                "dateJalali": r["date_jalali"],
                "amount": float(r["amount"] or 0),
                "bankDescription": r["bank_description"] or "",
                "status": r["status"],
                "accountingId": r["accounting_id"],
                "accountingEntryId": r["accounting_entry_id"],
                "accountingDescription": r["accounting_description"],
                "accountingDebit": float(r["accounting_debit"]) if r["accounting_debit"] is not None else None,
                "accountingCredit": float(r["accounting_credit"]) if r["accounting_credit"] is not None else None,
                "linkId": r["link_id"],
                "matchType": r["match_type"],
                "confidence": float(r["confidence"]) if r["confidence"] is not None else None,
            }
            for r in rows
        ]

    def list_layer4(self) -> list[dict]:
        rows = self.db.execute(
            select(
                PosTransaction, AccountingEntry, ReconciliationLink
            ).join(
                ReconciliationLink, (ReconciliationLink.pos_tx_id == PosTransaction.id) & (ReconciliationLink.layer == 4), isouter=True
            ).join(
                AccountingEntry, AccountingEntry.id == ReconciliationLink.accounting_id, isouter=True
            ).order_by(PosTransaction.date_jalali, PosTransaction.branch_name, PosTransaction.id)
        ).all()
        return [
            {
                "posTxId": p.id,
                "refNumber": p.ref_number,
                "cardNumberMasked": p.card_number_masked,
                "branchName": p.branch_name,
                "dateJalali": p.date_jalali,
                "amount": float(p.amount),
                "status": p.status,
                "accountingId": a.id if a else None,
                "entryId": a.entry_id if a else None,
                "accountingDescription": a.description if a else None,
                "matchType": l.match_type if l else None,
                "aggregated": bool(a and a.description and "سرجمع" in a.description),
            }
            for p, a, l in rows
        ]

    def list_uploaded_files(self) -> list[dict]:
        rows = list(self.db.execute(
            select(UploadedFile).order_by(UploadedFile.upload_date.desc(), UploadedFile.id.desc())
        ).scalars())
        return [
            {
                "id": f.id,
                "templateId": f.template_id,
                "originalFilename": f.original_filename,
                "source": f.source,
                "uploadDate": str(f.upload_date),
                "uploadedBy": f.uploaded_by,
                "rowCount": f.row_count,
            }
            for f in rows
        ]

    def dashboard_stats(self, date_jalali: str | None = None) -> DashboardStats:
        l1 = _counts_by_status(self.db, PosSummary)
        l3_where = BankTransaction.tx_type.in_(("transfer", "check", "other"))
        if date_jalali:
            l1 = _counts_by_status(self.db, PosSummary, PosSummary.date_jalali == date_jalali)
            l3_where = l3_where & (BankTransaction.date_jalali == date_jalali)
        l3 = _counts_by_status(self.db, BankTransaction, l3_where)
        l4 = _counts_by_status(self.db, PosTransaction,
                               PosTransaction.date_jalali == date_jalali if date_jalali else None)
        if date_jalali:
            fee_where = (BankTransaction.tx_type == "fee") & (BankTransaction.date_jalali == date_jalali)
        else:
            fee_where = BankTransaction.tx_type == "fee"
        l2 = _counts_by_status(self.db, BankTransaction, fee_where)
        registered = self.db.execute(
            select(func.count()).select_from(FeeAggregation).where(FeeAggregation.registered == True)  # noqa: E712
        ).scalar() or 0
        l2.pending = registered
        l2.total = l2.matched + l2.unmatched

        q = select(func.coalesce(func.sum(FeeAggregation.total_amount), 0)).where(FeeAggregation.registered == False)  # noqa: E712
        if date_jalali:
            q = q.where(FeeAggregation.date_jalali == date_jalali)
        unregistered_total = float(self.db.execute(q).scalar() or 0)
        date_total = None
        if date_jalali:
            date_total = float(self.db.execute(
                select(func.coalesce(func.sum(FeeAggregation.total_amount), 0))
                .where(FeeAggregation.date_jalali == date_jalali)
            ).scalar() or 0)

        return DashboardStats(
            layer1=l1, layer2=l2, layer3=l3, layer4=l4,
            unregistered_fee_total=unregistered_total,
            date_fee_total=date_total,
        )

    def list_audit(self, limit: int = 50) -> list[dict]:
        from app.models.user import User

        rows = self.db.execute(
            select(AuditLog, User.username).join(User, User.id == AuditLog.user_id, isouter=True)
            .order_by(AuditLog.timestamp.desc()).limit(limit)
        ).all()
        return [
            {
                "timestamp": str(a.timestamp),
                "username": username,
                "action": a.action,
                "entityType": a.entity_type,
                "entityId": a.entity_id,
            }
            for a, username in rows
        ]
