"""Jalali date utilities (equivalent of the TS jalali-date helpers)."""
from datetime import date, timedelta

import jdatetime


def parse_jalali(date_str: str) -> jdatetime.date | None:
    """Parses YYYY/MM/DD (or with -) into a jdatetime.date; None when invalid."""
    if not date_str:
        return None
    s = str(date_str).strip().replace("-", "/")
    parts = s.split("/")
    if len(parts) != 3:
        return None
    try:
        jy, jm, jd = int(parts[0]), int(parts[1]), int(parts[2])
        return jdatetime.date(jy, jm, jd)
    except (ValueError, TypeError):
        return None


def format_jalali(jd: jdatetime.date) -> str:
    return f"{jd.year}/{jd.month:02d}/{jd.day:02d}"


def jalali_add_days(date_str: str, n: int) -> str:
    """Adds n days to a jalali date string; returns input when unparseable."""
    jd = parse_jalali(date_str)
    if jd is None:
        return date_str
    g = jd.togregorian() + timedelta(days=n)
    return format_jalali(jdatetime.date.fromgregorian(date=g))


def jalali_days_between(a: str, b: str) -> int | None:
    """Days from a to b (b - a), or None when either is invalid."""
    ja, jb = parse_jalali(a), parse_jalali(b)
    if ja is None or jb is None:
        return None
    return (jb.togregorian() - ja.togregorian()).days


def today_jalali() -> str:
    return format_jalali(jdatetime.date.today())
