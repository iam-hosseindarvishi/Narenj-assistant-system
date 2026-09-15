"""Adapter tests: excel reading, keyword classification, template engine."""
import os

from app.adapters.excel_reader import ExcelReader
from app.adapters.keshavarzi import KeshavarziAdapter
from app.adapters.mohkam import MohkamAdapter
from app.adapters.pos_adapters import PosSummaryAdapter, PosTransactionAdapter
from app.adapters.template_engine import TemplateEngine

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")


class FakeTemplate:
    def __init__(self, mapping, cleanup, extraction=None):
        self.column_mapping = mapping
        self.cleanup_rules = cleanup
        self.extraction_rules = extraction or []


def test_excel_reader_reads_xls():
    rows = ExcelReader().read(open(os.path.join(FIXTURES, "Bank.xls"), "rb").read(), "Bank.xls")
    assert len(rows) > 100


def test_excel_reader_reads_xlsx():
    rows = ExcelReader().read(
        open(os.path.join(FIXTURES, "pos_transactions.xlsx"), "rb").read(), "pos_transactions.xlsx"
    )
    assert len(rows) == 1121  # 1120 data rows + header


def test_excel_reader_parses_pasted_tsv():
    tsv = "date\tref\tamount\n1405/06/01\tABC\t1000\n1405/06/02\tDEF\t2000\n"
    rows = ExcelReader().read_pasted(tsv)
    assert len(rows) == 3
    assert rows[1][0] == "1405/06/01"


def test_col_letter_to_index():
    assert TemplateEngine.col_letter_to_index("A") == 0
    assert TemplateEngine.col_letter_to_index("B") == 1
    assert TemplateEngine.col_letter_to_index("Z") == 25
    assert TemplateEngine.col_letter_to_index("AA") == 26
    assert TemplateEngine.col_letter_to_index("M") == 12


def test_bank_classification():
    detect = KeshavarziAdapter.detect_tx_type
    assert detect("واريزپايا شرح: |140506030162267303 نام واریز کننده: X") == "shaparak"
    assert detect("واريزپايا مرکزشاپرک") == "shaparak"
    assert detect("واريزپايا") == "fee"
    assert detect("کارمزد بانکی") == "fee"
    assert detect("ثبت چک") == "fee"
    assert detect("واریز چک شماره 987654") == "check"
    assert detect("انتقال وجه شبا") == "transfer"
    assert detect("سایر تراکنش") == "other"


def test_bank_adapter_parses_fixture():
    rows = ExcelReader().read(open(os.path.join(FIXTURES, "Bank.xls"), "rb").read(), "Bank.xls")
    template = FakeTemplate(
        {
            "rowNumber": "M", "date": "L", "time": "K", "branchCode": "I",
            "reference": "J", "payerPayee": "E", "depositRef": "A",
            "description": "B", "deposit": "G", "withdrawal": "H",
            "balance": "F", "depositTracking": "C", "id": "D",
        },
        {"skipTopRows": [1], "skipBottomRows": 0, "headerRow": 1},
    )
    normalized = KeshavarziAdapter().parse(rows, template)
    assert len(normalized) == 150, "fixture parity: bank statement rows"
    types = {n.tx_type for n in normalized}
    assert "shaparak" in types
    assert "fee" in types


def test_accounting_adapter_extracts_havale_ref():
    rows = ExcelReader().read(open(os.path.join(FIXTURES, "System.xls"), "rb").read(), "System.xls")
    template = FakeTemplate(
        {"entryId": "A", "date": "B", "debit": "C", "credit": "D", "description": "E"},
        {"headerRow": 1},
        [
            {"field": "halavehRef", "pattern": r"حواله\s*\((\d+)\)", "mode": "regex"},
            {"field": "cardLast4", "pattern": r"ک\s*(\d{4})", "mode": "regex"},
            {"field": "branchName", "pattern": r"نارنج\s*(\d+)", "mode": "regex"},
        ],
    )
    normalized = MohkamAdapter().parse(rows, template)
    assert len(normalized) == 253, "fixture parity: accounting entries"
    with_havale = [n for n in normalized if n.halaveh_ref]
    assert with_havale, "expected havale refs to be extracted"


def test_pos_summary_adapter():
    rows = ExcelReader().read(
        open(os.path.join(FIXTURES, "pos_summarize.xlsx"), "rb").read(), "pos_summarize.xlsx"
    )
    template = FakeTemplate(
        {"branchId": "A", "branchName": "B", "terminalId": "C", "txCount": "D", "amount": "E", "date": "F"},
        {"headerRow": 1},
    )
    normalized = PosSummaryAdapter().parse(rows, template)
    assert len(normalized) == 45, "fixture parity: POS summaries (L1 = 45)"


def test_pos_detail_adapter_row_count():
    rows = ExcelReader().read(
        open(os.path.join(FIXTURES, "pos_transactions.xlsx"), "rb").read(), "pos_transactions.xlsx"
    )
    template = FakeTemplate(
        {"trackingCode": "A", "cardNumber": "B", "branchName": "D", "time": "I",
         "amount": "H", "status": "N", "date": "J"},
        {"headerRow": 1},
    )
    normalized = PosTransactionAdapter().parse(rows, template)
    assert len(normalized) == 1120, "fixture parity: POS detail rows"
