"""Accounting entries imported from Mohkam."""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AccountingEntry(Base):
    __tablename__ = "accounting_entries"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    file_id: Mapped[int] = mapped_column(ForeignKey("uploaded_files.id"), nullable=False, index=True)
    entry_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    date_jalali: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    debit: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    credit: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    description: Mapped[str | None] = mapped_column(Text)
    entry_type: Mapped[str] = mapped_column(String(20), nullable=False, default="other", index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="unmatched", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
