"""Import pipeline: workbook bytes or pasted text -> rows -> DB, per template."""
import re
from decimal import Decimal

from sqlalchemy import insert
from sqlalchemy.orm import Session

from app.adapters.excel_reader import ExcelReader
from app.adapters.keshavarzi import KeshavarziAdapter
from app.adapters.mohkam import MohkamAdapter
from app.adapters.pos_adapters import PosSummaryAdapter, PosTransactionAdapter
from app.models.accounting_entry import AccountingEntry
from app.models.bank_transaction import BankTransaction
from app.models.pos import PosSummary, PosTransaction
from app.models.template import Template
from app.models.uploaded_file import UploadedFile


class ImportResult:
    def __init__(self, total_rows: int, parsed_rows: int, file_id: int, errors: list[str]):
        self.total_rows = total_rows
        self.parsed_rows = parsed_rows
        self.skipped_rows = total_rows - parsed_rows
        self.file_id = file_id
        self.errors = errors


class FileImporter:
    """Coordinates readers, adapters, and persistence for both import channels."""

    def __init__(self, db: Session):
        self.db = db
        self.reader = ExcelReader()

    def import_bytes(self, file_bytes: bytes, filename: str, template: Template, uploaded_by: int | None = None) -> ImportResult:
        rows = self.reader.read(file_bytes, filename)
        return self._persist(rows, template, filename, "file", uploaded_by)

    def import_pasted(self, text: str, template: Template, uploaded_by: int | None = None) -> ImportResult:
        rows = self.reader.read_pasted(text)
        return self._persist(rows, template, "clipboard-paste", "clipboard", uploaded_by)

    def remove_file(self, file_id: int) -> bool:
        file = self.db.get(UploadedFile, file_id)
        if not file:
            return False
        self.db.execute(
            ReconciliationLinkDelete().delete_for_file(file_id)
        )
        self.db.execute(
            BankTransaction.__table__.delete().where(BankTransaction.file_id == file_id)
        )
        self.db.execute(PosSummary.__table__.delete().where(PosSummary.file_id == file_id))
        self.db.execute(PosTransaction.__table__.delete().where(PosTransaction.file_id == file_id))
        self.db.execute(AccountingEntry.__table__.delete().where(AccountingEntry.file_id == file_id))
        self.db.delete(file)
        self.db.commit()
        return True

    # -- internals -----------------------------------------------------------
    def _persist(self, rows, template: Template, filename: str, source: str, uploaded_by: int | None) -> ImportResult:
        total = len(rows)
        try:
            uf = UploadedFile(
                template_id=template.id,
                original_filename=filename,
                stored_path=filename,
                source=source,
                uploaded_by=uploaded_by,
                row_count=0,
            )
            self.db.add(uf)
            self.db.flush()

            if template.type == "bank":
                parsed = self._import_bank(rows, template, uf.id)
            elif template.type == "pos_summary":
                parsed = self._import_pos_summary(rows, template, uf.id)
            elif template.type == "pos_detail":
                parsed = self._import_pos_detail(rows, template, uf.id)
            elif template.type == "accounting":
                parsed = self._import_accounting(rows, template, uf.id)
            else:
                parsed = 0

            uf.row_count = parsed
            self.db.commit()
            return ImportResult(total_rows=total, parsed_rows=parsed, file_id=uf.id, errors=[])
        except Exception as exc:
            self.db.rollback()
            return ImportResult(total_rows=total, parsed_rows=0, file_id=0, errors=[str(exc)])

    def _import_bank(self, rows, template: Template, file_id: int) -> int:
        normalized = KeshavarziAdapter().parse(rows, template)
        self.db.execute(
            insert(BankTransaction),
            [
                {
                    "file_id": file_id,
                    "row_number": tx.row_number,
                    "date_jalali": tx.date_jalali,
                    "time": tx.time,
                    "branch_code": tx.branch_code,
                    "reference": tx.reference,
                    "payer_payee": tx.payer_payee,
                    "deposit_ref": tx.deposit_ref,
                    "deposit_amount": tx.deposit_amount,
                    "withdrawal_amount": tx.withdrawal_amount,
                    "balance": tx.balance,
                    "description": tx.description,
                    "tx_type": tx.tx_type,
                    "status": "unmatched",
                }
                for tx in normalized
            ],
        )
        return len(normalized)

    def _import_pos_summary(self, rows, template: Template, file_id: int) -> int:
        normalized = PosSummaryAdapter().parse(rows, template)
        self.db.execute(
            insert(PosSummary),
            [
                {
                    "file_id": file_id,
                    "branch_id": s.branch_id,
                    "branch_name": s.branch_name,
                    "terminal_id": s.terminal_id,
                    "tx_count": s.tx_count,
                    "amount": s.amount,
                    "date_jalali": s.date_jalali,
                    "status": "unmatched",
                }
                for s in normalized
            ],
        )
        return len(normalized)

    def _import_pos_detail(self, rows, template: Template, file_id: int) -> int:
        normalized = PosTransactionAdapter().parse(rows, template)
        self.db.execute(
            insert(PosTransaction),
            [
                {
                    "file_id": file_id,
                    "ref_number": t.tracking_code,
                    "card_number_masked": t.card_number,
                    "branch_name": t.branch_name,
                    "time": t.time,
                    "amount": t.amount,
                    "pos_status": t.status,
                    "date_jalali": t.date_jalali,
                    "status": "unmatched",
                }
                for t in normalized
            ],
        )
        return len(normalized)

    def _import_accounting(self, rows, template: Template, file_id: int) -> int:
        normalized = MohkamAdapter().to_rows(rows, template) if hasattr(MohkamAdapter, "to_rows") else MohkamAdapter().parse(rows, template)
        self.db.execute(
            insert(AccountingEntry),
            [
                {
                    "file_id": file_id,
                    "entry_id": e.entry_id,
                    "date_jalali": e.date_jalali,
                    "debit": e.debit,
                    "credit": e.credit,
                    "description": e.description,
                    "entry_type": e.entry_type,
                    "status": "unmatched",
                }
                for e in normalized
            ],
        )
        return len(normalized)


class ReconciliationLinkDelete:
    """Builds the delete statement for links touching any record of a file."""

    @staticmethod
    def delete_for_file(file_id: int):
        from app.models.reconciliation_link import ReconciliationLink

        return ReconciliationLink.__table__.delete().where(
            ReconciliationLink.bank_tx_id.in_(
                select_ids(BankTransaction, file_id)
            )
            | ReconciliationLink.pos_summary_id.in_(select_ids(PosSummary, file_id))
            | ReconciliationLink.pos_tx_id.in_(select_ids(PosTransaction, file_id))
            | ReconciliationLink.accounting_id.in_(select_ids(AccountingEntry, file_id))
        )


def select_ids(model, file_id: int):
    from sqlalchemy import select

    return select(model.id).where(model.file_id == file_id)
