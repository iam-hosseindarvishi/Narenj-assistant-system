"""Seeds default templates and the bootstrap admin user (idempotent)."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.template import Template
from app.models.user import User

DEFAULT_TEMPLATES = [
    {
        "id": 1,
        "name": "Bank Keshavarzi",
        "type": "bank",
        "column_mapping": {
            "rowNumber": "M", "date": "L", "time": "K", "branchCode": "I",
            "reference": "J", "payerPayee": "E", "depositRef": "A",
            "description": "B", "deposit": "G", "withdrawal": "H",
            "balance": "F", "depositTracking": "C", "id": "D",
        },
        "cleanup_rules": {"skipTopRows": [1], "skipBottomRows": 0, "headerRow": 1},
        "extraction_rules": [
            {"field": "branchId", "pattern": r"^IR.*0{7,}(\\d{7,})", "mode": "regex"},
            {"field": "depositRefClean", "pattern": r"^IR(.+)$", "mode": "regex"},
        ],
    },
    {
        "id": 2,
        "name": "POS Summary (Behpardakht)",
        "type": "pos_summary",
        "column_mapping": {
            "branchId": "A", "branchName": "B", "terminalId": "C",
            "txCount": "D", "amount": "E", "date": "F",
        },
        "cleanup_rules": {"skipTopRows": [], "skipBottomRows": 0, "headerRow": 1},
        "extraction_rules": [],
    },
    {
        "id": 3,
        "name": "POS Detail (Behpardakht)",
        "type": "pos_detail",
        "column_mapping": {
            "trackingCode": "A", "cardNumber": "B", "branchName": "D",
            "time": "I", "amount": "H", "status": "N", "date": "J",
        },
        "cleanup_rules": {"skipTopRows": [], "skipBottomRows": 0, "headerRow": 1},
        "extraction_rules": [],
    },
    {
        "id": 4,
        "name": "Mohkam Accounting",
        "type": "accounting",
        "column_mapping": {
            "entryId": "A", "date": "B", "debit": "C", "credit": "D", "description": "E",
        },
        "cleanup_rules": {"skipTopRows": [], "skipBottomRows": 0, "headerRow": 1},
        "extraction_rules": [
            {"field": "halavehRef", "pattern": r"حواله\s*\((\d+)\)", "mode": "regex"},
            {"field": "cardLast4", "pattern": r"ک\s*(\d{4})", "mode": "regex"},
            {"field": "branchName", "pattern": r"نارنج\s*(\d+)", "mode": "regex"},
        ],
    },
]


def seed_defaults(db: Session) -> None:
    """Creates the four default templates and the admin user when missing."""
    for spec in DEFAULT_TEMPLATES:
        exists = db.execute(select(Template).where(Template.name == spec["name"])).scalar_one_or_none()
        if not exists:
            db.add(Template(
                name=spec["name"],
                type=spec["type"],
                column_mapping=spec["column_mapping"],
                cleanup_rules=spec["cleanup_rules"],
                extraction_rules=spec["extraction_rules"],
            ))

    from app.core.config import get_settings

    settings = get_settings()
    admin = db.execute(select(User).where(User.username == settings.admin_username)).scalar_one_or_none()
    if not admin:
        db.add(User(
            username=settings.admin_username,
            password_hash=hash_password(settings.admin_password),
            role="admin",
        ))
    db.commit()
