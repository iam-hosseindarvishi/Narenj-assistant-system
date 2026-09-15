"""Pydantic schemas for API requests/responses."""
from pydantic import BaseModel, Field

from app.core.permissions import permissions_for_role


# -- auth ----------------------------------------------------------------------
class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=200)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: int
    username: str
    role: str
    permissions: list[str] = []

    class Config:
        from_attributes = True


# -- import ----------------------------------------------------------------------
class ImportResultOut(BaseModel):
    total_rows: int
    parsed_rows: int
    skipped_rows: int
    file_id: int
    errors: list[str]


class ClipboardImportRequest(BaseModel):
    template_id: int
    text: str = Field(min_length=1, max_length=10_000_000)


# -- manual ----------------------------------------------------------------------
class ManualSelectionItem(BaseModel):
    system: str  # bank | accounting | pos
    id: int


class ManualLinkRequest(BaseModel):
    selection: list[ManualSelectionItem] = Field(min_length=2)


class SuggestionDecisionRequest(BaseModel):
    link_id: int
