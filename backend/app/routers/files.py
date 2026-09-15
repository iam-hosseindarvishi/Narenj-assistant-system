"""Import endpoints: Excel upload and clipboard paste, plus file history/removal."""
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_operator, require_viewer
from app.models.template import Template
from app.models.user import User
from app.schemas import ClipboardImportRequest, ImportResultOut
from app.services.file_importer import FileImporter
from app.services.queries import QueryHelper

router = APIRouter(prefix="/files", tags=["files"])

ALLOWED_EXTENSIONS = (".xls", ".xlsx", ".xlsm")
MAX_UPLOAD_BYTES = 20 * 1024 * 1024


async def _import(payload_bytes: bytes | None, filename: str, text: str | None,
                  template_id: int, db: Session, user: User) -> ImportResultOut:
    template = db.get(Template, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    importer = FileImporter(db)
    if text is not None:
        result = importer.import_pasted(text, template, uploaded_by=user.id)
    else:
        result = importer.import_bytes(payload_bytes, filename, template, uploaded_by=user.id)
    if result.errors:
        raise HTTPException(status_code=422, detail="; ".join(result.errors))
    return ImportResultOut(
        total_rows=result.total_rows,
        parsed_rows=result.parsed_rows,
        skipped_rows=result.skipped_rows,
        file_id=result.file_id,
        errors=result.errors,
    )


@router.post("/upload", response_model=ImportResultOut, dependencies=[Depends(require_operator)])
async def upload_file(
    template_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    name = file.filename or ""
    if not name.lower().endswith(ALLOWED_EXTENSIONS):
        raise HTTPException(status_code=415, detail="Only .xls/.xlsx/.xlsm files are supported")
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 20 MB)")
    return await _import(data, name, None, template_id, db, user)


@router.post("/clipboard", response_model=ImportResultOut, dependencies=[Depends(require_operator)])
async def import_clipboard(
    payload: ClipboardImportRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await _import(None, "clipboard", payload.text, payload.template_id, db, user)


@router.get("", dependencies=[Depends(require_viewer)])
def list_files(db: Session = Depends(get_db)):
    return QueryHelper(db).list_uploaded_files()


@router.delete("/{file_id}", dependencies=[Depends(require_operator)])
def delete_file(file_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ok = FileImporter(db).remove_file(file_id)
    if not ok:
        raise HTTPException(status_code=404, detail="File not found")
    return {"ok": True}
