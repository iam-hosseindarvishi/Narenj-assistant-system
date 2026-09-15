"""Reconciliation endpoints: run layers, list per-layer views, manual matching."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_operator, require_viewer
from app.models.user import User
from app.schemas import ManualLinkRequest
from app.services.layers.layer1 import Layer1Reconciler
from app.services.layers.layer2 import Layer2Reconciler
from app.services.layers.layer3 import Layer3Reconciler
from app.services.layers.layer4 import Layer4Reconciler
from app.services.manual_matching import ManualMatchingService
from app.services.queries import QueryHelper

router = APIRouter(prefix="/reconciliation", tags=["reconciliation"])


@router.post("/run/layer1", dependencies=[Depends(require_operator)])
def run_layer1(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    result = Layer1Reconciler(db).reconcile()
    return {"matched": result.matched, "pending": result.pending, "unmatched": result.unmatched}


@router.post("/run/layer2", dependencies=[Depends(require_operator)])
def run_layer2(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    result = Layer2Reconciler(db).reconcile()
    return {"matched": result.matched, "aggregated": result.aggregated}


@router.post("/run/layer3", dependencies=[Depends(require_operator)])
def run_layer3(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    result = Layer3Reconciler(db).reconcile()
    if not result.ok:
        raise HTTPException(status_code=500, detail=result.error)
    return {"matched": result.matched, "pending": result.pending, "unmatched": result.unmatched}


@router.post("/run/layer4", dependencies=[Depends(require_operator)])
def run_layer4(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    result = Layer4Reconciler(db).reconcile()
    if not result.ok:
        raise HTTPException(status_code=500, detail=result.error)
    return {"matched": result.matched, "pending": result.pending, "unmatched": result.unmatched}


@router.post("/run/all", dependencies=[Depends(require_operator)])
def run_all(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    r1 = Layer1Reconciler(db).reconcile()
    r2 = Layer2Reconciler(db).reconcile()
    r3 = Layer3Reconciler(db).reconcile()
    r4 = Layer4Reconciler(db).reconcile()
    return {
        "layer1": {"matched": r1.matched, "pending": r1.pending, "unmatched": r1.unmatched},
        "layer2": {"matched": r2.matched, "aggregated": r2.aggregated},
        "layer3": {"matched": r3.matched, "pending": r3.pending, "unmatched": r3.unmatched,
                   "error": r3.error},
        "layer4": {"matched": r4.matched, "pending": r4.pending, "unmatched": r4.unmatched,
                   "error": r4.error},
    }


@router.get("/layer1", dependencies=[Depends(require_viewer)])
def layer1(db: Session = Depends(get_db)):
    return QueryHelper(db).list_layer1()


@router.get("/layer2", dependencies=[Depends(require_viewer)])
def layer2(db: Session = Depends(get_db)):
    return QueryHelper(db).list_layer2()


@router.get("/layer3", dependencies=[Depends(require_viewer)])
def layer3(db: Session = Depends(get_db)):
    return QueryHelper(db).list_layer3()


@router.get("/layer4", dependencies=[Depends(require_viewer)])
def layer4(db: Session = Depends(get_db)):
    return QueryHelper(db).list_layer4()


@router.post("/fees/{date_jalali}/register", dependencies=[Depends(require_operator)])
def register_fees(date_jalali: str, registered: bool = Query(True),
                  db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    Layer2Reconciler(db).register_fees(date_jalali, registered, user.id)
    return {"ok": True}


# -- manual matching ------------------------------------------------------------
@router.get("/manual", dependencies=[Depends(require_viewer)])
def manual_list(date_from: str | None = None, date_to: str | None = None,
                system: str | None = None, db: Session = Depends(get_db)):
    return ManualMatchingService(db).list(date_from, date_to, system)


@router.post("/manual/link", dependencies=[Depends(require_operator)])
def manual_link(payload: ManualLinkRequest, db: Session = Depends(get_db),
                user: User = Depends(get_current_user)):
    try:
        link_id = ManualMatchingService(db).link(
            [item.model_dump() for item in payload.selection], user.id
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return {"id": link_id}


@router.delete("/manual/link/{link_id}", dependencies=[Depends(require_operator)])
def manual_unlink(link_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        ManualMatchingService(db).unlink(link_id, user.id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {"ok": True}


@router.post("/manual/suggestions/accept", dependencies=[Depends(require_operator)])
def accept_suggestion(payload: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ok = ManualMatchingService(db).accept_suggestion(int(payload.get("link_id", 0)), user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    return {"ok": True}


@router.post("/manual/suggestions/reject", dependencies=[Depends(require_operator)])
def reject_suggestion(payload: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ok = ManualMatchingService(db).reject_suggestion(int(payload.get("link_id", 0)), user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    return {"ok": True}
