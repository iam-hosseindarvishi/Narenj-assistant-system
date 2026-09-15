"""Template engine: maps spreadsheet columns per template, applies cleanup and extraction rules."""
import re
from typing import Any

from app.adapters.excel_reader import SheetRow


class TemplateEngine:
    """Shared mapping/extraction utilities used by every adapter."""

    @staticmethod
    def col_letter_to_index(letter: str) -> int:
        """'A' -> 0, 'B' -> 1, ... 'AA' -> 26, matching spreadsheet semantics."""
        col = 0
        for ch in (letter or "").strip().upper():
            if "A" <= ch <= "Z":
                col = col * 26 + (ord(ch) - ord("A") + 1)
            elif ch.isdigit():
                col = col * 26 + int(ch)
            else:
                continue
        return col - 1

    @staticmethod
    def cell_str(value: Any) -> str:
        """Stringify a cell like JS String(): whole floats lose the trailing .0."""
        if value is None:
            return ""
        if isinstance(value, float) and value.is_integer():
            return str(int(value))
        return str(value).strip()

    @staticmethod
    def map_row(row: SheetRow, column_mapping: dict[str, str]) -> dict[str, Any]:
        mapped: dict[str, Any] = {}
        for field, letter in column_mapping.items():
            idx = TemplateEngine.col_letter_to_index(letter)
            mapped[field] = row[idx] if idx >= 0 and idx < len(row) else None
        return mapped

    @staticmethod
    def cleanup_skip(i: int, rows_count: int, cleanup: dict[str, Any]) -> bool:
        """True when row index i must be skipped per cleanup rules.

        Matches the Electron app: headerRow=1 means data starts at index 1
        (the header row itself is consumed)."""
        skip_top = set(cleanup.get("skipTopRows") or [])
        header_row = int(cleanup.get("headerRow") or 1)
        skip_bottom = int(cleanup.get("skipBottomRows") or 0)
        row_num = i + 1
        return row_num in skip_top or row_num <= header_row or i >= rows_count - skip_bottom

    @staticmethod
    def apply_rule(text: str, rule: dict[str, Any]) -> str | None:
        if not text:
            return None
        pattern = rule.get("pattern", "")
        mode = rule.get("mode", "regex")
        if mode != "regex" or not pattern:
            return None
        match = re.search(pattern, text)
        return match.group(1) if match and match.groups() else (match.group(0) if match else None)

    @classmethod
    def apply_all_rules(cls, text: str, rules: list[dict[str, Any]]) -> dict[str, str]:
        extracted: dict[str, str] = {}
        for rule in rules or []:
            value = cls.apply_rule(text, rule)
            if value is not None and rule.get("field"):
                extracted[rule["field"]] = value
        return extracted
