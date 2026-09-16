"""All models imported for Alembic autogenerate and metadata discovery."""
from app.models.accounting_entry import AccountingEntry
from app.models.audit_log import AuditLog
from app.models.bank import Bank, PosBranch
from app.models.bank_transaction import BankTransaction
from app.models.fee_aggregation import FeeAggregation
from app.models.pos import PosSummary, PosTransaction
from app.models.reconciliation_link import ReconciliationLink
from app.models.sales import (
    Customer,
    CustomerRoute,
    CustomerVisitorLink,
    ProductGroup,
    Sale,
    SalesRoute,
    Visitor,
    VisitorGroupRule,
    WeeklyPlan,
)
from app.models.template import Template
from app.models.uploaded_file import UploadedFile
from app.models.user import User

__all__ = [
    "AccountingEntry",
    "AuditLog",
    "Bank",
    "PosBranch",
    "BankTransaction",
    "FeeAggregation",
    "PosSummary",
    "PosTransaction",
    "ReconciliationLink",
    "Customer",
    "CustomerRoute",
    "CustomerVisitorLink",
    "ProductGroup",
    "Sale",
    "SalesRoute",
    "Visitor",
    "VisitorGroupRule",
    "WeeklyPlan",
    "Template",
    "UploadedFile",
    "User",
]
