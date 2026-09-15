"""Behpardakht POS adapters (summary + transaction detail)."""
import re
from dataclasses import dataclass

from app.adapters.excel_reader import SheetRow
from app.adapters.template_engine import TemplateEngine
from app.models.template import Template


def cell_str(value: object) -> str:
    """Stringify a cell like JS String(): whole floats lose the trailing .0."""
    return TemplateEngine.cell_str(value)


@dataclass
class NormalizedPosSummaryRow:
    branch_id: str
    branch_name: str
    terminal_id: str
    tx_count: int
    amount: float
    date_jalali: str


@dataclass
class NormalizedPosTransactionRow:
    tracking_code: str
    card_number: str
    branch_name: str
    time: str
    amount: float
    status: str
    date_jalali: str


class PosSummaryAdapter:
    def parse(self, rows: list[SheetRow], template: Template) -> list[NormalizedPosSummaryRow]:
        result: list[NormalizedPosSummaryRow] = []
        cleanup = template.cleanup_rules or {}
        for i, row in enumerate(rows):
            if TemplateEngine.cleanup_skip(i, len(rows), cleanup):
                continue
            if not row or len(row) == 0:
                continue
            mapped = TemplateEngine.map_row(row, template.column_mapping)
            date = str(mapped.get("date") or "").strip()
            if not date:
                continue
            result.append(
                NormalizedPosSummaryRow(
                    branch_id=TemplateEngine.cell_str(mapped.get("branchId")),
                    branch_name=TemplateEngine.cell_str(mapped.get("branchName")),
                    terminal_id=TemplateEngine.cell_str(mapped.get("terminalId")),
                    tx_count=to_int(mapped.get("txCount")),
                    amount=to_float(mapped.get("amount")),
                    date_jalali=date,
                )
            )
        return result


class PosTransactionAdapter:
    def parse(self, rows: list[SheetRow], template: Template) -> list[NormalizedPosTransactionRow]:
        result: list[NormalizedPosTransactionRow] = []
        cleanup = template.cleanup_rules or {}
        for i, row in enumerate(rows):
            if TemplateEngine.cleanup_skip(i, len(rows), cleanup):
                continue
            if not row or len(row) == 0:
                continue
            mapped = TemplateEngine.map_row(row, template.column_mapping)
            ref = str(mapped.get("trackingCode") or "").strip()
            if not ref:
                continue
            result.append(
                NormalizedPosTransactionRow(
                    tracking_code=cell_str(mapped.get("trackingCode")),
                    card_number=cell_str(mapped.get("cardNumber")),
                    branch_name=cell_str(mapped.get("branchName")),
                    time=cell_str(mapped.get("time")),
                    amount=to_float(mapped.get("amount")),
                    status=cell_str(mapped.get("status")),
                    date_jalali=cell_str(mapped.get("date")),
                )
            )
        return result


def to_float(value: object) -> float:
    """Numeric coercion tolerant of Persian digits and separators."""
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


def to_int(value: object) -> int:
    try:
        return int(float(value)) if value not in (None, "") else 0
    except (TypeError, ValueError):
        return 0
