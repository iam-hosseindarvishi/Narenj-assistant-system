"""Layer 3 tests: exact match, havale paren disambiguation, suggestions."""
import os

import pytest

from app.adapters.excel_reader import ExcelReader
from app.services.file_importer import FileImporter
from app.services.layers.layer3 import Layer3Reconciler
from tests.test_adapters import FIXTURES, FakeTemplate


def _import_real(db, templates):
    bank_tpl = FakeTemplate(
        templates["bank"]["column_mapping"], templates["bank"]["cleanup_rules"]
    )
    acc_tpl = FakeTemplate(
        templates["accounting"]["column_mapping"], templates["accounting"]["cleanup_rules"],
        templates["accounting"]["extraction_rules"],
    )
    reader = ExcelReader()
    bank_rows = reader.read(open(os.path.join(FIXTURES, "Bank.xls"), "rb").read(), "Bank.xls")
    acc_rows = reader.read(open(os.path.join(FIXTURES, "System.xls"), "rb").read(), "System.xls")
    FileImporter(db).import_bytes(open(os.path.join(FIXTURES, "Bank.xls"), "rb").read(), "Bank.xls", _as_template(bank_tpl))
    FileImporter(db).import_bytes(open(os.path.join(FIXTURES, "System.xls"), "rb").read(), "System.xls", _as_template(acc_tpl))


def _as_template(fake):
    from app.models.template import Template

    return Template(
        id=1, name="x", type=fake.column_mapping and _infer_type(fake),
        column_mapping=fake.column_mapping, cleanup_rules=fake.cleanup_rules,
        extraction_rules=fake.extraction_rules,
    )


def _infer_type(fake):
    if "depositRef" in fake.column_mapping:
        return "bank"
    if "entryId" in fake.column_mapping:
        return "accounting"
    return "other"


def test_havale_paren_numbers_extraction():
    extract = Layer3Reconciler._havale_paren_numbers
    assert extract("سند دریافت(5085) حواله (803392) کشاورزی") == ["803392"]
    assert extract("سند پرداخت(1068) حواله پرداختی (061809) کشاورزی") == ["061809"]
    assert extract("حواله (0079347 8963437 89634370157) کشاورزی") == ["0079347", "8963437", "89634370157"]
    assert extract("حواله شماره 061809 بدون پرانتز") == []
    assert extract("") == []
    assert extract(None) == []


def test_bank_text_contains_number_end_of_digit_run():
    contains = Layer3Reconciler._bank_text_contains_number
    assert contains("انتقال وجه شبا |140506030162267303", "267303")
    assert contains("واریز شبا 89634370157", "89634370157")
    # Shorter number must not prefix-match inside a longer digit run
    assert not contains("واریز شبا 89634370157", "8963437")
    assert not contains("", "123")
    assert not contains("text", "")


def test_layer3_single_candidate_auto_matches(db_session, templates):
    from app.models.accounting_entry import AccountingEntry
    from app.models.bank_transaction import BankTransaction

    db_session.add(BankTransaction(
        file_id=1, row_number=1, date_jalali="1405/06/15", deposit_amount=200_000_000,
        withdrawal_amount=0, description="انتقال وجه شبا 12345", tx_type="transfer", status="unmatched",
    ))
    db_session.add(AccountingEntry(
        file_id=2, entry_id=9001, date_jalali="1405/06/15", debit=200_000_000, credit=0,
        description="سند دریافت 9001", entry_type="receipt", status="unmatched",
    ))
    db_session.commit()

    result = Layer3Reconciler(db_session).reconcile()
    assert result.ok
    assert result.matched == 1
    link = result.links[0]
    assert link.match_type == "auto"
    assert link.confidence == 1.0


def test_layer3_havale_paren_disambiguates(db_session, templates):
    from app.models.accounting_entry import AccountingEntry
    from app.models.bank_transaction import BankTransaction

    db_session.add(BankTransaction(
        file_id=1, row_number=1, date_jalali="1405/06/18", deposit_amount=30_000_000,
        withdrawal_amount=0, description="انتقال وجه شبا |140506030162267303",
        tx_type="transfer", status="unmatched",
    ))
    db_session.add_all([
        AccountingEntry(file_id=2, entry_id=9101, date_jalali="1405/06/18", debit=30_000_000, credit=0,
                        description="سند پرداخت(1094) حواله پرداختی (267303) کشاورزی",
                        entry_type="payment", status="unmatched"),
        AccountingEntry(file_id=2, entry_id=9102, date_jalali="1405/06/18", debit=30_000_000, credit=0,
                        description="سند پرداخت(1094) حواله پرداختی (141403) کشاورزی",
                        entry_type="payment", status="unmatched"),
    ])
    db_session.commit()

    result = Layer3Reconciler(db_session).reconcile()
    assert result.ok
    assert result.matched == 1
    link = result.links[0]
    assert link.match_type == "auto"
    assert link.confidence == 0.85
    acc = db_session.get(AccountingEntry, link.accounting_id)
    assert "267303" in acc.description


def test_layer3_multi_number_group(db_session, templates):
    from app.models.accounting_entry import AccountingEntry
    from app.models.bank_transaction import BankTransaction

    db_session.add(BankTransaction(
        file_id=1, row_number=1, date_jalali="1405/06/19", deposit_amount=45_000_000,
        withdrawal_amount=0, description="واریز شبا 89634370157", tx_type="transfer", status="unmatched",
    ))
    db_session.add_all([
        AccountingEntry(file_id=2, entry_id=9111, date_jalali="1405/06/19", debit=45_000_000, credit=0,
                        description="سند دریافت(5131) حواله (121697 8963437 89634370157) کشاورزی",
                        entry_type="receipt", status="unmatched"),
        AccountingEntry(file_id=2, entry_id=9112, date_jalali="1405/06/19", debit=45_000_000, credit=0,
                        description="سند دریافت(5104) حواله (375045 8963437 89634370159) کشاورزی",
                        entry_type="receipt", status="unmatched"),
    ])
    db_session.commit()

    result = Layer3Reconciler(db_session).reconcile()
    assert result.ok
    assert result.matched == 1
    acc = db_session.get(AccountingEntry, result.links[0].accounting_id)
    assert "89634370157" in acc.description


def test_layer3_shared_number_is_suggestion(db_session, templates):
    from app.models.accounting_entry import AccountingEntry
    from app.models.bank_transaction import BankTransaction

    db_session.add(BankTransaction(
        file_id=1, row_number=1, date_jalali="1405/06/21", deposit_amount=60_000_000,
        withdrawal_amount=0, description="واریز شبا 555000", tx_type="transfer", status="unmatched",
    ))
    db_session.add_all([
        AccountingEntry(file_id=2, entry_id=9121, date_jalali="1405/06/21", debit=60_000_000, credit=0,
                        description="سند دریافت(6001) حواله (555000) کشاورزی - فاکتور الف",
                        entry_type="receipt", status="unmatched"),
        AccountingEntry(file_id=2, entry_id=9122, date_jalali="1405/06/21", debit=60_000_000, credit=0,
                        description="سند دریافت(6002) حواله (555000) کشاورزی - فاکتور ب",
                        entry_type="receipt", status="unmatched"),
    ])
    db_session.commit()

    result = Layer3Reconciler(db_session).reconcile()
    assert result.ok
    assert result.matched == 0
    assert result.pending == 1
    assert result.links[0].match_type == "suggested"


def test_layer3_narenj_excluded(db_session, templates):
    from app.models.accounting_entry import AccountingEntry
    from app.models.bank_transaction import BankTransaction

    db_session.add(BankTransaction(
        file_id=1, row_number=1, date_jalali="1405/06/15", deposit_amount=200_000_000,
        withdrawal_amount=0, reference="REF12345", description="انتقال وجه شبا 12345",
        tx_type="transfer", status="unmatched",
    ))
    db_session.add_all([
        AccountingEntry(file_id=2, entry_id=9001, date_jalali="1405/06/15", debit=200_000_000, credit=0,
                        description="سند دریافت ک 3215 - نارنج 12", entry_type="receipt", status="unmatched"),
        AccountingEntry(file_id=2, entry_id=9002, date_jalali="1405/06/15", debit=200_000_000, credit=0,
                        description="سند دریافت شبا کشاورزی حواله (12345)", entry_type="receipt", status="unmatched"),
    ])
    db_session.commit()

    result = Layer3Reconciler(db_session).reconcile()
    assert result.ok
    assert result.matched == 1
    acc = db_session.get(AccountingEntry, result.links[0].accounting_id)
    assert "نارنج" not in acc.description
