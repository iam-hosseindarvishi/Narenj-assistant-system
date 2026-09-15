"""Report, dashboard, and audit endpoints."""
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from io import BytesIO
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_viewer
from app.services.queries import QueryHelper
from app.services.reports import ReportGenerator

router = APIRouter(tags=["reports"])


@router.get("/dashboard", dependencies=[Depends(require_viewer)])
def dashboard(date: str | None = None, db: Session = Depends(get_db)):
    stats = QueryHelper(db).dashboard_stats(date)
    return {
        "layer1": stats.layer1.__dict__,
        "layer2": stats.layer2.__dict__,
        "layer3": stats.layer3.__dict__,
        "layer4": stats.layer4.__dict__,
        "unregisteredFeeTotal": stats.unregistered_fee_total,
        "dateFeeTotal": stats.date_fee_total,
    }


@router.get("/reports", dependencies=[Depends(require_viewer)])
def report(date_from: str | None = None, date_to: str | None = None, db: Session = Depends(get_db)):
    return ReportGenerator(db).generate(date_from, date_to)


@router.get("/reports/export", dependencies=[Depends(require_viewer)])
def report_export(db: Session = Depends(get_db)):
    data = ReportGenerator(db).export_excel()
    return StreamingResponse(
        BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="narenj-report.xlsx"'},
    )


@router.get("/audit", dependencies=[Depends(require_viewer)])
def audit(limit: int = Query(50, le=500), db: Session = Depends(get_db)):
    return QueryHelper(db).list_audit(limit)
