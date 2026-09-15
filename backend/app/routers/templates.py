"""Template management endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_admin, require_viewer
from app.models.template import Template
from app.models.user import User

router = APIRouter(prefix="/templates", tags=["templates"])


class TemplateUpdate(BaseModel):
    name: str | None = None
    column_mapping: dict | None = None
    cleanup_rules: dict | None = None
    extraction_rules: list[dict] | None = None


@router.get("", dependencies=[Depends(require_viewer)])
def list_templates(db: Session = Depends(get_db)):
    rows = list(db.execute(select(Template).order_by(Template.id)).scalars())
    return [
        {
            "id": t.id, "name": t.name, "type": t.type,
            "columnMapping": t.column_mapping,
            "cleanupRules": t.cleanup_rules,
            "extractionRules": t.extraction_rules,
        }
        for t in rows
    ]


@router.put("/{template_id}", dependencies=[Depends(require_admin)])
def update_template(template_id: int, payload: TemplateUpdate, db: Session = Depends(get_db)):
    template = db.get(Template, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if payload.name is not None:
        template.name = payload.name
    if payload.column_mapping is not None:
        template.column_mapping = payload.column_mapping
    if payload.cleanup_rules is not None:
        template.cleanup_rules = payload.cleanup_rules
    if payload.extraction_rules is not None:
        template.extraction_rules = payload.extraction_rules
    db.commit()
    return {"ok": True}
