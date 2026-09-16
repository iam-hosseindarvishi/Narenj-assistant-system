"""Role → module permissions.

Central place for deciding which system modules each role can access.
Today permissions derive from the fixed roles; when per-user permission
assignment is introduced later, only this mapping (or a DB-backed
replacement of ``permissions_for_role``) needs to change.
"""

# Known modules. New panels (reports, settings, ...) get added here.
MODULES = {
    "reconciliation": "مغایرت‌گیری بانکی",
    "sales_base": "اطلاعات پایه فروش",
}

# Minimum role tier per module. "viewer" < "operator" < "admin".
_MIN_ROLE = {"viewer": 1, "operator": 2, "admin": 3}

# Which modules each role tier can enter.
_MODULE_MIN_ROLE = {
    "reconciliation": "viewer",
    "sales_base": "viewer",
}


def permissions_for_role(role: str) -> list[str]:
    """Module ids the role may enter; admin always has everything."""
    tier = _MIN_ROLE.get(role)
    if tier is None:
        return []
    if role == "admin":
        return sorted(MODULES)
    return [mid for mid, min_role in _MODULE_MIN_ROLE.items() if tier >= _MIN_ROLE[min_role]]
