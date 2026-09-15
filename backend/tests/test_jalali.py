"""Jalali date utility tests."""
from app.services.jalali import jalali_add_days, jalali_days_between, parse_jalali, today_jalali


def test_parse_valid():
    jd = parse_jalali("1405/06/15")
    assert jd is not None
    assert (jd.year, jd.month, jd.day) == (1405, 6, 15)


def test_parse_invalid():
    assert parse_jalali("not-a-date") is None
    assert parse_jalali("1405/13/01") is None
    assert parse_jalali("") is None


def test_add_days_month_boundary():
    assert jalali_add_days("1405/06/31", 1) == "1405/07/01"


def test_add_days_year_boundary():
    assert jalali_add_days("1404/12/29", 1) == "1405/01/01"


def test_add_days_leap_year():
    # 1403 is a leap year: Esfand has 30 days
    assert jalali_add_days("1403/12/30", 1) == "1404/01/01"


def test_days_between():
    assert jalali_days_between("1405/06/01", "1405/06/02") == 1
    assert jalali_days_between("1405/06/31", "1405/07/02") == 2


def test_today_returns_parseable():
    assert parse_jalali(today_jalali()) is not None
