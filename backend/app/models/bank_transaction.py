"""Bank transaction rows imported from bank statements."""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class BankTransaction(Base):
    __tablename__ = "bank_transactions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    file_id: Mapped[int] = mapped_column(ForeignKey("uploaded_files.id"), nullable=False, index=True)
    row_number: Mapped[int] = mapped_column(nullable=False)
    date_jalali: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    time: Mapped[str | None] = mapped_column(String(20))
    branch_code: Mapped[str | None] = mapped_column(String(30))
    reference: Mapped[str | None] = mapped_column(String(100))
    payer_payee: Mapped[str | None] = mapped_column(Text)
    deposit_ref: Mapped[str | None] = mapped_column(Text)
    deposit_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    withdrawal_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    balance: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    description: Mapped[str | None] = mapped_column(Text)
    tx_type: Mapped[str] = mapped_column(String(20), nullable=False, default="other", index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="unmatched", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
