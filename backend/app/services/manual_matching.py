"""Manual matching: list unmatched records, link/unlink pairs, cleanup helpers."""
from __future__ import annotations

import json

from sqlalchemy import select, delete, func, text
from sqlalchemy.orm import Session

from app.models.accounting_entry import AccountingEntry
from app.models.audit_log import AuditLog
from app.models.bank_transaction import BankTransaction
from app.models.pos import PosTransaction
from app.models.reconciliation_link import ReconciliationLink


class ManualMatchingService:
    def __init__(self, db: Session):
        self.db = db

    def list(self, date_from: str | None = None, date_to: str | None = None, system: str | None = None) -> list[dict]:
        records = self._accounting(date_from, date_to)
        if system == "pos":
            records += self._pos(date_from, date_to)
        else:
            records += self._bank(date_from, date_to)
        records.sort(key=lambda r: r["dateJalali"])
        return records

    def link(self, selection: list[dict], user_id: int | None = None) -> int:
        if len(selection) < 2:
            raise ValueError("At least two records are required")
        ids = {"bank": None, "accounting": None, "pos": None}
        for item in selection:
            ids[item["system"]] = int(item["id"])
        layer = 4 if ids["pos"] is not None else (3 if ids["bank"] is not None and ids["accounting"] is not None else 1)
        link = ReconciliationLink(
            layer=layer, bank_tx_id=ids["bank"], pos_tx_id=ids["pos"], accounting_id=ids["accounting"],
            match_type="manual", created_by=user_id, note="Manual reconciliation",
        )
        self.db.add(link)
        self._set_statuses(ids, "manual")
        self.db.add(AuditLog(
            user_id=user_id, action="manual-link", entity_type="reconciliation_links",
            entity_id=None, new_value=json.dumps(selection, ensure_ascii=False),
        ))
        self.db.commit()
        return link.id

    def unlink(self, link_id: int, user_id: int | None = None) -> None:
        link = self.db.get(ReconciliationLink, link_id)
        if not link:
            raise ValueError("Link not found")
        ids = {"bank": link.bank_tx_id, "accounting": link.accounting_id, "pos": link.pos_tx_id}
        self.db.execute(delete(ReconciliationLink).where(ReconciliationLink.id == link_id))
        self._set_statuses(ids, "unmatched")
        self.db.add(AuditLog(
            user_id=user_id, action="manual-unlink", entity_type="reconciliation_links",
            entity_id=link_id, new_value=None,
        ))
        self.db.commit()

    def accept_suggestion(self, link_id: int, user_id: int | None = None) -> bool:
        link = self.db.execute(
            select(ReconciliationLink).where(
                ReconciliationLink.id == link_id,
                ReconciliationLink.layer == 3,
                ReconciliationLink.match_type == "suggested",
            )
        ).scalar_one_or_none()
        if not link:
            return False
        link.match_type = "manual"
        link.created_by = user_id
        link.note = "User accepted suggestion"
        if link.bank_tx_id is not None:
            self.db.execute(BankTransaction.__table__.update()
                            .where(BankTransaction.id == link.bank_tx_id).values(status="matched"))
        if link.accounting_id is not None:
            self.db.execute(AccountingEntry.__table__.update()
                            .where(AccountingEntry.id == link.accounting_id).values(status="matched"))
        self.db.add(AuditLog(user_id=user_id, action="accept-suggestion",
                             entity_type="reconciliation_links", entity_id=link_id, new_value=None))
        self.db.commit()
        return True

    def reject_suggestion(self, link_id: int, user_id: int | None = None) -> bool:
        result = self.db.execute(
            delete(ReconciliationLink).where(
                ReconciliationLink.id == link_id,
                ReconciliationLink.layer == 3,
                ReconciliationLink.match_type == "suggested",
            )
        )
        if result.rowcount:
            self.db.add(AuditLog(user_id=user_id, action="reject-suggestion",
                                 entity_type="reconciliation_links", entity_id=link_id, new_value=None))
        self.db.commit()
        return bool(result.rowcount)

    def cleanup_orphaned_links(self) -> int:
        """Removes suggested links whose records are deleted or already matched."""
        stmt = text("""
            DELETE FROM reconciliation_links
            WHERE match_type = 'suggested' AND (
              (bank_tx_id IS NOT NULL AND (
                NOT EXISTS (SELECT 1 FROM bank_transactions t WHERE t.id = bank_tx_id)
                OR EXISTS (SELECT 1 FROM bank_transactions t WHERE t.id = bank_tx_id AND t.status != 'unmatched')
              ))
              OR (accounting_id IS NOT NULL AND (
                NOT EXISTS (SELECT 1 FROM accounting_entries t WHERE t.id = accounting_id)
                OR EXISTS (SELECT 1 FROM accounting_entries t WHERE t.id = accounting_id AND t.status != 'unmatched')
              ))
              OR (pos_tx_id IS NOT NULL AND (
                NOT EXISTS (SELECT 1 FROM pos_transactions t WHERE t.id = pos_tx_id)
                OR EXISTS (SELECT 1 FROM pos_transactions t WHERE t.id = pos_tx_id AND t.status != 'unmatched')
              ))
            )
        """)
        return self.db.execute(stmt).rowcount or 0

    # -- record listings -----------------------------------------------------
    def _bank(self, date_from: str | None, date_to: str | None) -> list[dict]:
        stmt = select(BankTransaction).where(
            BankTransaction.status == "unmatched",
            BankTransaction.tx_type != "fee",
        )
        if date_from:
            stmt = stmt.where(BankTransaction.date_jalali >= date_from)
        if date_to:
            stmt = stmt.where(BankTransaction.date_jalali <= date_to)
        rows = list(self.db.execute(stmt.order_by(BankTransaction.date_jalali)).scalars())
        return [
            {
                "id": r.id, "system": "bank", "dateJalali": r.date_jalali,
                "amount": float(r.deposit_amount or r.withdrawal_amount),
                "label": r.description or r.reference or "",
                "status": r.status,
                "suggestionLinkId": self._suggestion_link_id(r.id, "bank"),
            }
            for r in rows
        ]

    def _accounting(self, date_from: str | None, date_to: str | None) -> list[dict]:
        stmt = select(AccountingEntry).where(AccountingEntry.status == "unmatched")
        if date_from:
            stmt = stmt.where(AccountingEntry.date_jalali >= date_from)
        if date_to:
            stmt = stmt.where(AccountingEntry.date_jalali <= date_to)
        rows = list(self.db.execute(stmt.order_by(AccountingEntry.date_jalali)).scalars())
        return [
            {
                "id": r.id, "system": "accounting", "dateJalali": r.date_jalali,
                "amount": float(r.credit or r.debit),
                "label": r.description or str(r.entry_id),
                "status": r.status,
                "suggestionLinkId": self._suggestion_link_id(r.id, "accounting"),
            }
            for r in rows
        ]

    def _pos(self, date_from: str | None, date_to: str | None) -> list[dict]:
        stmt = select(PosTransaction).where(PosTransaction.status == "unmatched")
        if date_from:
            stmt = stmt.where(PosTransaction.date_jalali >= date_from)
        if date_to:
            stmt = stmt.where(PosTransaction.date_jalali <= date_to)
        rows = list(self.db.execute(stmt.order_by(PosTransaction.date_jalali)).scalars())
        return [
            {
                "id": r.id, "system": "pos", "dateJalali": r.date_jalali or "",
                "amount": float(r.amount),
                "label": f"{r.branch_name or ''} {r.ref_number}",
                "status": r.status,
                "suggestionLinkId": self._suggestion_link_id(r.id, "pos"),
            }
            for r in rows
        ]

    def _suggestion_link_id(self, record_id: int, system: str) -> int | None:
        col = {"bank": ReconciliationLink.bank_tx_id,
               "accounting": ReconciliationLink.accounting_id,
               "pos": ReconciliationLink.pos_tx_id}[system]
        return self.db.execute(
            select(ReconciliationLink.id).where(
                ReconciliationLink.match_type == "suggested", col == record_id,
            ).limit(1)
        ).scalar_one_or_none()

    def _set_statuses(self, ids: dict, status: str) -> None:
        if ids.get("bank") is not None:
            self.db.execute(BankTransaction.__table__.update()
                            .where(BankTransaction.id == ids["bank"]).values(status=status))
        if ids.get("accounting") is not None:
            self.db.execute(AccountingEntry.__table__.update()
                            .where(AccountingEntry.id == ids["accounting"]).values(status=status))
        if ids.get("pos") is not None:
            self.db.execute(PosTransaction.__table__.update()
                            .where(PosTransaction.id == ids["pos"]).values(status=status))

