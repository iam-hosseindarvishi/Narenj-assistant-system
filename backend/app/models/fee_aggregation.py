"""Daily fee aggregations (layer 2 bookkeeping)."""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class FeeAggregation(Base):
    __tablename__ = "fee_aggregations"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    date_jalali: Mapped[str] = mapped_column(String(10), nullable=False, unique=True, index=True)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    registered: Mapped[bool] = mapped_column(nullable=False, default=False)
    registered_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    registered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
