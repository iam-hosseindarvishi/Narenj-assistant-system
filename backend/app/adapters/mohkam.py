"""Mohkam accounting adapter."""
import re
from dataclasses import dataclass

from app.adapters.excel_reader import SheetRow
from app.adapters.template_engine import TemplateEngine
from app.models.template import Template


@dataclass
class NormalizedAccountingRow:
    entry_id: int
    date_jalali: str
    debit: float
    credit: float
    description: str
    entry_type: str
    halaveh_ref: str | None
    card_last4: str | None
    branch_name: str | None


class MohkamAdapter:
    """Parses accounting entries and extracts havale/card/branch references."""

    def parse(self, rows: list[SheetRow], template: Template) -> list[NormalizedAccountingRow]:
        result: list[NormalizedAccountingRow] = []
        header_row = int((template.cleanup_rules or {}).get("headerRow") or 1)
        for i in range(header_row, len(rows)):
            row = rows[i]
            if not row or len(row) == 0:
                continue
            mapped = TemplateEngine.map_row(row, template.column_mapping)
            if not mapped.get("date") and not mapped.get("description"):
                continue
            description = str(mapped.get("description") or "").strip()
            extracted = TemplateEngine.apply_all_rules(description, template.extraction_rules or [])
            result.append(
                NormalizedAccountingRow(
                    entry_id=self.to_int(mapped.get("entryId")),
                    date_jalali=str(mapped.get("date") or "").strip(),
                    debit=self.to_float(mapped.get("debit")),
                    credit=self.to_float(mapped.get("credit")),
                    description=description,
                    entry_type=self.detect_entry_type(description),
                    halaveh_ref=extracted.get("halavehRef"),
                    card_last4=extracted.get("cardLast4"),
                    branch_name=extracted.get("branchName"),
                )
            )
        return result

    @staticmethod
    def to_float(value: object) -> float:
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
    def to_int(value: object) -> int:
        try:
            return int(float(value)) if value not in (None, "") else 0
        except (TypeError, ValueError):
            return 0

    @staticmethod
    def detect_entry_type(description: str) -> str:
        if "سند دریافت" in description:
            return "receipt"
        if "سند پرداخت" in description:
            return "payment"
        if "کارمزد" in description:
            return "fee"
        if "چک" in description:
            return "check"
        return "other"
