"""Sales-base module: visitors, routes, customers, product groups, rules, sales."""
from datetime import date, datetime

from sqlalchemy import BigInteger, Boolean, Date, DateTime, ForeignKey, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Visitor(Base):
    __tablename__ = "visitors"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(50))
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SalesRoute(Base):
    __tablename__ = "sales_routes"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500))
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class WeeklyPlan(Base):
    """Weekly visit schedule: which route a visitor covers on each weekday.

    weekday: 0 = Saturday (شنبه) ... 6 = Friday (جمعه).
    """
    __tablename__ = "weekly_plans"
    __table_args__ = (UniqueConstraint("visitor_id", "weekday", "route_id", name="uq_weekly_plan"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    visitor_id: Mapped[int] = mapped_column(ForeignKey("visitors.id", ondelete="CASCADE"), nullable=False, index=True)
    weekday: Mapped[int] = mapped_column(nullable=False)
    route_id: Mapped[int] = mapped_column(ForeignKey("sales_routes.id", ondelete="CASCADE"), nullable=False, index=True)


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(50))
    address: Mapped[str | None] = mapped_column(String(500))
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    routes: Mapped[list["CustomerRoute"]] = relationship(
        primaryjoin="Customer.id == CustomerRoute.customer_id", cascade="all, delete-orphan", viewonly=True
    )


class CustomerRoute(Base):
    """Assigns a visit route to a customer (many customers per route)."""
    __tablename__ = "customer_routes"
    __table_args__ = (UniqueConstraint("customer_id", "route_id", name="uq_customer_route"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("sales_routes.id", ondelete="CASCADE"), nullable=False, index=True)


class CustomerVisitorLink(Base):
    """Customer ↔ visitor relationship (many-to-many in every direction)."""
    __tablename__ = "customer_visitor_links"
    __table_args__ = (UniqueConstraint("customer_id", "visitor_id", name="uq_customer_visitor"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    visitor_id: Mapped[int] = mapped_column(ForeignKey("visitors.id", ondelete="CASCADE"), nullable=False, index=True)


class ProductGroup(Base):
    __tablename__ = "product_groups"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class VisitorGroupRule(Base):
    """Exclusive right: visitor may sell this group in this route.

    By default every visitor may sell every group; creating a rule here means
    that in ``route_id`` only ``visitor_id`` is entitled to sell ``group_id``.
    """
    __tablename__ = "visitor_group_rules"
    __table_args__ = (UniqueConstraint("visitor_id", "route_id", "group_id", name="uq_visitor_group_rule"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    visitor_id: Mapped[int] = mapped_column(ForeignKey("visitors.id", ondelete="CASCADE"), nullable=False, index=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("sales_routes.id", ondelete="CASCADE"), nullable=False, index=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("product_groups.id", ondelete="CASCADE"), nullable=False, index=True)


class Sale(Base):
    """Sales fact rows (populated later from an external source; engine-ready)."""
    __tablename__ = "sales"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    visitor_id: Mapped[int] = mapped_column(ForeignKey("visitors.id"), nullable=False, index=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("sales_routes.id"), nullable=False, index=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("product_groups.id"), nullable=False, index=True)
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id"))
    amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    sale_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
