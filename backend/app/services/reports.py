"""Reconciliation reports: dataset + Excel export (XlsxWriter)."""
import io
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.accounting_entry import AccountingEntry
from app.models.bank_transaction import BankTransaction
from app.services.queries import QueryHelper

UNMATCHED_LIMIT = 200


class ReportGenerator:
    def __init__(self, db: Session):
        self.db = db
        self.queries = QueryHelper(db)

    def generate(self, date_from: str | None = None, date_to: str | None = None) -> dict:
        stats = self.queries.dashboard_stats()
        sections = [
            {"section": "لایه ۱: پوز-بانک", "total": stats.layer1.total,
             "matched": stats.layer1.matched + stats.layer1.manual},
            {"section": "لایه ۲: کارمزد", "total": stats.layer2.total,
             "matched": stats.layer2.matched},
            {"section": "لایه ۳: بانک-حسابداری", "total": stats.layer3.total,
             "matched": stats.layer3.matched + stats.layer3.manual},
            {"section": "لایه ۴: ریز پوز", "total": stats.layer4.total,
             "matched": stats.layer4.matched + stats.layer4.manual},
        ]
        return {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "from": date_from,
            "to": date_to,
            "sections": sections,
            "fees": self.queries.list_layer2(),
            "unmatched": self._unmatched_lists(date_from, date_to),
            "unregisteredFeeTotal": stats.unregistered_fee_total,
            "auditTrail": self.queries.list_audit(20),
        }

    def export_excel(self) -> bytes:
        """Builds the four-sheet Persian report workbook; returns bytes."""
        data = self.generate()
        import xlsxwriter

        buffer = io.BytesIO()
        wb = xlsxwriter.Workbook(buffer, {"in_memory": True})
        ws = wb.add_worksheet("خلاصه")
        ws.write_row(0, 0, ["بخش", "کل", "تطبیق‌شده", "باقی‌مانده"])
        for r, s in enumerate(data["sections"], start=1):
            ws.write_row(r, 0, [s["section"], s["total"], s["matched"], s["total"] - s["matched"]])

        ws2 = wb.add_worksheet("رکوردهای تطبیق‌نشده")
        ws2.write_row(0, 0, ["سیستم", "تاریخ", "مبلغ", "شرح"])
        u = data["unmatched"]
        r = 1
        for row in ([("بانک", x) for x in u["bank"]]
                    + [("حسابداری", x) for x in u["accounting"]]
                    + [("پوز", x) for x in u["pos"]]
                    + [("خلاصه پوز", x) for x in u["posSummary"]]):
            system, x = row
            ws2.write_row(r, 0, [system, x["dateJalali"], x["amount"], x["label"]])
            r += 1

        ws3 = wb.add_worksheet("کارمزدها")
        ws3.write_row(0, 0, ["تاریخ", "مبلغ کل", "متصل", "متصل‌نشده", "ثبت‌شده"])
        for r, f in enumerate(data["fees"], start=1):
            ws3.write_row(r, 0, [f["dateJalali"], f["totalAmount"], f["linkedCount"],
                                 f["unlinkedCount"], "بله" if f["registered"] else "خیر"])

        ws4 = wb.add_worksheet("گزارش حسابرسی")
        ws4.write_row(0, 0, ["زمان", "کاربر", "عملیات", "موجودیت", "شناسه"])
        for r, a in enumerate(data["auditTrail"], start=1):
            ws4.write_row(r, 0, [a["timestamp"], a["username"] or "-", a["action"],
                                 a["entityType"], a["entityId"] if a["entityId"] is not None else "-"])

        wb.close()
        return buffer.getvalue()

    def _unmatched_lists(self, date_from: str | None, date_to: str | None) -> dict:
        from sqlalchemy import select

        from app.models.pos import PosSummary, PosTransaction

        def limited(model, columns):
            stmt = select(*columns).where(model.status == "unmatched")
            if date_from:
                stmt = stmt.where(model.date_jalali >= date_from)
            if date_to:
                stmt = stmt.where(model.date_jalali <= date_to)
            stmt = stmt.order_by(model.date_jalali).limit(UNMATCHED_LIMIT)
            return self.db.execute(stmt).all()

        bank = limited(BankTransaction, (BankTransaction.date_jalali, BankTransaction.deposit_amount,
                                         BankTransaction.withdrawal_amount, BankTransaction.description,
                                         BankTransaction.reference))
        acc = limited(AccountingEntry, (AccountingEntry.date_jalali, AccountingEntry.debit,
                                        AccountingEntry.credit, AccountingEntry.description,
                                        AccountingEntry.entry_id))
        pos = limited(PosTransaction, (PosTransaction.date_jalali, PosTransaction.amount,
                                       PosTransaction.branch_name, PosTransaction.ref_number))
        summary = limited(PosSummary, (PosSummary.date_jalali, PosSummary.amount,
                                       PosSummary.branch_id, PosSummary.branch_name))

        return {
            "bank": [{"dateJalali": d, "amount": float(dep or 0) + float(wd or 0),
                      "label": desc or ref or ""} for d, dep, wd, desc, ref in bank],
            "accounting": [{"dateJalali": d, "amount": float(cr or dr),
                            "label": desc or str(eid or "")} for d, dr, cr, desc, eid in acc],
            "pos": [{"dateJalali": d, "amount": float(a or 0),
                     "label": f"{bn or ''} {rf or ''}".strip()} for d, a, bn, rf in pos],
            "posSummary": [{"dateJalali": d, "amount": float(a or 0),
                            "label": f"{bi or ''} {bn or ''}".strip()} for d, a, bi, bn in summary],
        }
