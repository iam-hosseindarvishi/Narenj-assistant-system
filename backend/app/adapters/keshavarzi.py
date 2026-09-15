"""Keshavarzi bank statement adapter."""
from dataclasses import dataclass

from app.adapters.excel_reader import SheetRow
from app.adapters.template_engine import TemplateEngine
from app.models.template import Template


@dataclass
class NormalizedBankRow:
    row_number: int
    date_jalali: str
    time: str
    branch_code: str
    reference: str
    payer_payee: str
    deposit_ref: str
    deposit_amount: float
    withdrawal_amount: float
    balance: float
    description: str
    tx_type: str


class KeshavarziAdapter:
    """Parses bank rows and classifies transaction type via Persian keywords."""

    def parse(self, rows: list[SheetRow], template: Template) -> list[NormalizedBankRow]:
        result: list[NormalizedBankRow] = []
        cleanup = template.cleanup_rules or {}
        for i, row in enumerate(rows):
            if TemplateEngine.cleanup_skip(i, len(rows), cleanup):
                continue
            if not row or len(row) == 0:
                continue
            mapped = TemplateEngine.map_row(row, template.column_mapping)
            if not mapped.get("date") and not mapped.get("reference"):
                continue
            normalized = self.normalize(mapped, i + 1)
            if normalized:
                result.append(normalized)
        return result

    def normalize(self, mapped: dict, row_num: int) -> NormalizedBankRow | None:
        date_jalali = str(mapped.get("date") or "").strip()
        if not date_jalali:
            return None

        deposit_ref = str(mapped.get("depositRef") or "").strip()
        description = str(mapped.get("description") or mapped.get("payerPayee") or "").strip()

        branch_code = ""
        if deposit_ref and deposit_ref.startswith("IR"):
            extracted = TemplateEngine.apply_rule(
                deposit_ref,
                {"field": "branchId", "pattern": r"^IR.*0{7,}(\d{7,})", "mode": "regex"},
            )
            if extracted:
                branch_code = extracted[:7]

        tx_type = self.detect_tx_type(description)
        try:
            src_row = int(float(mapped.get("rowNumber")))
        except (TypeError, ValueError):
            src_row = 0
        row_number = src_row if src_row > 0 else row_num

        return NormalizedBankRow(
            row_number=row_number,
            date_jalali=date_jalali,
            time=str(mapped.get("time") or "").strip(),
            branch_code=branch_code,
            reference=str(mapped.get("reference") or "").strip(),
            payer_payee=str(mapped.get("payerPayee") or "").strip(),
            deposit_ref=deposit_ref,
            deposit_amount=self.to_float(mapped.get("deposit")),
            withdrawal_amount=self.to_float(mapped.get("withdrawal")),
            balance=self.to_float(mapped.get("balance")),
            description=description,
            tx_type=tx_type,
        )

    @staticmethod
    def to_float(value: object) -> float:
        """Numeric coercion tolerant of Persian digits, commas, and blanks."""
        if value is None:
            return 0.0
        if isinstance(value, (int, float)):
            return float(value)
        s = str(value).strip()
        if not s:
            return 0.0
        persian = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
        s = s.translate(persian).replace(",", "").replace("،", "").replace("٬", "").replace(" ", "")
        try:
            return float(s)
        except ValueError:
            return 0.0

    @staticmethod
    def detect_tx_type(description: str) -> str:
        # Shaparak/POS deposits: detailed واريزپايا or مرکزشاپرک/شاپارک
        if (
            (description and "واريزپايا" in description and ("شرح:" in description or "نام واریز کننده" in description))
            or (description and "واريزپايا" in description and "مرکزشاپرک" in description)
            or (description and "شاپارک" in description)
        ):
            return "shaparak"
        # Fee: bare واريزپايا or explicit fee keywords
        if (
            (description and "واريزپايا" in description and "شرح:" not in description and "نام واریز کننده" not in description and "مرکزشاپرک" not in description)
            or (description and "کارمزد" in description)
            or (description and "ثبت چک" in description)
        ):
            return "fee"
        if description and "چک" in description:
            return "check"
        if description and "انتقال" in description:
            return "transfer"
        return "other"
