"""Import templates for Excel parsing."""
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, BigInteger, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Template(Base):
    __tablename__ = "templates"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    type: Mapped[str] = mapped_column(String(30), nullable=False)  # bank|pos_summary|pos_detail|accounting
    bank_id: Mapped[int | None] = mapped_column(ForeignKey("banks.id"))
    # Portable JSON: PostgreSQL stores jsonb under the hood, SQLite uses TEXT
    column_mapping: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    cleanup_rules: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    extraction_rules: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
