"""Reconciliation links between systems."""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, DateTime, Text, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ReconciliationLink(Base):
    __tablename__ = "reconciliation_links"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    layer: Mapped[int] = mapped_column(nullable=False, index=True)  # 1..4
    bank_tx_id: Mapped[int | None] = mapped_column(ForeignKey("bank_transactions.id"))
    pos_summary_id: Mapped[int | None] = mapped_column(ForeignKey("pos_summaries.id"))
    pos_tx_id: Mapped[int | None] = mapped_column(ForeignKey("pos_transactions.id"))
    accounting_id: Mapped[int | None] = mapped_column(ForeignKey("accounting_entries.id"))
    match_type: Mapped[str] = mapped_column(String(20), nullable=False)  # auto|manual|suggested
    confidence: Mapped[Decimal] = mapped_column(Numeric(4, 3), nullable=False, default=1)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    note: Mapped[str | None] = mapped_column(Text)
