"""POS summary and POS transaction rows."""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PosSummary(Base):
    __tablename__ = "pos_summaries"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    file_id: Mapped[int] = mapped_column(ForeignKey("uploaded_files.id"), nullable=False, index=True)
    branch_id: Mapped[str] = mapped_column(String(50), nullable=False)
    branch_name: Mapped[str | None] = mapped_column(String(200))
    terminal_id: Mapped[str | None] = mapped_column(String(50))
    tx_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    date_jalali: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="unmatched", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PosTransaction(Base):
    __tablename__ = "pos_transactions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    file_id: Mapped[int] = mapped_column(ForeignKey("uploaded_files.id"), nullable=False, index=True)
    ref_number: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    card_number_masked: Mapped[str | None] = mapped_column(String(30))
    branch_name: Mapped[str | None] = mapped_column(String(200))
    time: Mapped[str | None] = mapped_column(String(20))
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    pos_status: Mapped[str | None] = mapped_column(String(50))
    date_jalali: Mapped[str | None] = mapped_column(String(10), index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="unmatched", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
