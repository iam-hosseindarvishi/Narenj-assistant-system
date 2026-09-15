"""Layer 1/2/4 tests and full real-fixture end-to-end parity."""
import os

import pytest

from app.adapters.excel_reader import ExcelReader
from app.models.template import Template
from app.services.file_importer import FileImporter
from app.services.layers.layer1 import Layer1Reconciler
from app.services.layers.layer2 import Layer2Reconciler
from app.services.layers.layer4 import Layer4Reconciler
from tests.test_adapters import FIXTURES


def _template_by_type(db, type_name):
    """Fetch the seeded default template of a given type (persisted, has id)."""
    from sqlalchemy import select

    return db.execute(select(Template).where(Template.type == type_name)).scalar_one()


def _import_all(db, _templates):
    importer = FileImporter(db)
    importer.import_bytes(open(os.path.join(FIXTURES, "Bank.xls"), "rb").read(), "Bank.xls",
                          _template_by_type(db, "bank"))
    importer.import_bytes(open(os.path.join(FIXTURES, "pos_summarize.xlsx"), "rb").read(), "pos_summarize.xlsx",
                          _template_by_type(db, "pos_summary"))
    importer.import_bytes(open(os.path.join(FIXTURES, "pos_transactions.xlsx"), "rb").read(), "pos_transactions.xlsx",
                          _template_by_type(db, "pos_detail"))
    importer.import_bytes(open(os.path.join(FIXTURES, "System.xls"), "rb").read(), "System.xls",
                          _template_by_type(db, "accounting"))


def test_layer1_fixture_parity(db_session, templates):
    _import_all(db_session, templates)
    result = Layer1Reconciler(db_session).reconcile()
    # Electron e2e asserts exactly 45 matches on these fixtures
    assert result.matched == 45, f"expected 45, got {result.matched}"


def test_layer2_runs_and_aggregates(db_session, templates):
    _import_all(db_session, templates)
    result = Layer2Reconciler(db_session).reconcile()
    assert result.aggregated > 0


def test_layer4_fixture_parity(db_session, templates):
    _import_all(db_session, templates)
    result = Layer4Reconciler(db_session).reconcile()
    assert result.ok
    assert result.matched > 0


def test_full_pipeline_parity(db_session, templates):
    """The whole import+reconcile flow reproduces the Electron app's counts."""
    _import_all(db_session, templates)
    from sqlalchemy import func, select

    from app.models.pos import PosTransaction

    pos_count = db_session.execute(select(func.count()).select_from(PosTransaction)).scalar()
    assert pos_count == 1120, "fixture parity: imported POS detail rows"

    r1 = Layer1Reconciler(db_session).reconcile()
    assert r1.matched == 45
    r2 = Layer2Reconciler(db_session).reconcile()
    assert r2.aggregated > 0
    r3 = Layer3ReconcilerSafe(db_session).reconcile()
    assert r3.ok
    from app.models.reconciliation_link import ReconciliationLink

    l3_links = db_session.execute(
        select(ReconciliationLink).where(ReconciliationLink.layer == 3)
    ).scalars().all()
    assert len(l3_links) == r3.matched + r3.pending
    r4 = Layer4Reconciler(db_session).reconcile()
    assert r4.ok


def test_clipboard_import(db_session, templates):
    """Clipboard paste goes through the same pipeline as file upload."""
    tsv = "\t".join(["A", "B", "C", "D", "E"]) + "\n"
    tsv += "\t".join(["77001", "1405/06/15", "100000", "0", "سند دریافت(1) حواله (555001) کشاورزی"]) + "\n"
    tsv += "\t".join(["77002", "1405/06/15", "0", "50000", "سند پرداخت(2) خرید"]) + "\n"
    importer = FileImporter(db_session)
    result = importer.import_pasted(tsv, _template_by_type(db_session, "accounting"))
    assert result.parsed_rows == 2
    assert result.file_id > 0


def test_import_then_remove_file(db_session, templates):
    _import_all(db_session, templates)
    from sqlalchemy import func, select

    from app.models.uploaded_file import UploadedFile

    files = list(db_session.execute(select(UploadedFile)).scalars())
    assert len(files) == 4
    target = files[0].id
    assert FileImporter(db_session).remove_file(target)
    remaining = db_session.execute(select(func.count()).select_from(UploadedFile)).scalar()
    assert remaining == 3


from app.services.layers.layer3 import Layer3Reconciler as Layer3ReconcilerSafe  # noqa: E402
