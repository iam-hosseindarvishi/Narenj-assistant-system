"""Sales-base module tests: CRUD, plans, links, rules, bulk, violations.

Uses unique entity codes per run so the suite is repeatable.
"""
import os
import uuid

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("JWT_SECRET", "test-secret")

from app.main import app  # noqa: E402

UID = uuid.uuid4().hex[:8]


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture()
def auth_headers(client):
    resp = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _visitor(client, h, code, name):
    r = client.post("/api/sales/visitors", headers=h, json={"code": code, "full_name": name})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _route(client, h, code, name):
    r = client.post("/api/sales/routes", headers=h, json={"code": code, "name": name})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _group(client, h, code, name):
    r = client.post("/api/sales/groups", headers=h, json={"code": code, "name": name})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_visitor_crud(client, auth_headers):
    h = auth_headers
    code = f"V-{UID}"
    r = client.post("/api/sales/visitors", headers=h, json={"code": code, "full_name": "علی محمدی"})
    assert r.status_code == 201
    vid = r.json()["id"]

    r = client.post("/api/sales/visitors", headers=h, json={"code": code, "full_name": "تکراری"})
    assert r.status_code == 409

    r = client.put(f"/api/sales/visitors/{vid}", headers=h, json={"full_name": "علی محمدیان"})
    assert r.status_code == 200
    assert r.json()["full_name"] == "علی محمدیان"

    r = client.get("/api/sales/visitors", headers=h)
    assert any(v["id"] == vid for v in r.json())

    r = client.delete(f"/api/sales/visitors/{vid}", headers=h)
    assert r.status_code == 200


def test_route_and_plan_crud(client, auth_headers):
    h = auth_headers
    rid = _route(client, h, f"R-{UID}", "مسیر مرکزی")
    vid = _visitor(client, h, f"V-{UID}", "ویزیتور ۱")

    r = client.post(
        "/api/sales/weekly-plans", headers=h,
        json={"visitor_id": vid, "items": [{"weekday": 0, "route_id": rid}, {"weekday": 2, "route_id": rid}]},
    )
    assert r.status_code == 201, r.text

    r = client.get("/api/sales/weekly-plans", headers=h)
    plans = [p for p in r.json() if p["visitor_id"] == vid]
    assert len(plans) == 1
    assert [d["weekday_name"] for d in plans[0]["days"]] == ["شنبه", "دوشنبه"]

    # Replace the plan for the same visitor
    r = client.post(
        "/api/sales/weekly-plans", headers=h,
        json={"visitor_id": vid, "items": [{"weekday": 4, "route_id": rid}]},
    )
    assert r.status_code == 201
    r = client.get("/api/sales/weekly-plans", headers=h)
    plans = [p for p in r.json() if p["visitor_id"] == vid]
    assert [d["weekday_name"] for d in plans[0]["days"]] == ["چهارشنبه"]

    r = client.delete(f"/api/sales/weekly-plans/{vid}", headers=h)
    assert r.status_code == 200


def test_customer_links_and_rules(client, auth_headers):
    h = auth_headers
    vid = _visitor(client, h, f"VC-{UID}", "علی")
    rid = _route(client, h, f"RC-{UID}", "مسیر ۱")
    gid = _group(client, h, f"GC-{UID}", "گروه الف")

    r = client.post("/api/sales/customers", headers=h, json={"code": f"C-{UID}", "name": "مغازه الف"})
    assert r.status_code == 201
    cid = r.json()["id"]

    r = client.post("/api/sales/customer-routes", headers=h, json={"customer_id": cid, "route_id": rid})
    assert r.status_code == 201, r.text
    r = client.post("/api/sales/customer-routes", headers=h, json={"customer_id": cid, "route_id": rid})
    assert r.status_code == 409  # duplicate link

    r = client.post("/api/sales/customer-visitors", headers=h, json={"customer_id": cid, "visitor_id": vid})
    assert r.status_code == 201, r.text

    # Customer list reflects its route
    r = client.get("/api/sales/customers", headers=h)
    assert [c for c in r.json() if c["id"] == cid][0]["route_ids"] == [rid]

    r = client.post("/api/sales/group-rules", headers=h, json={"visitor_id": vid, "route_id": rid, "group_id": gid})
    assert r.status_code == 201, r.text
    r = client.post("/api/sales/group-rules", headers=h, json={"visitor_id": vid, "route_id": rid, "group_id": gid})
    assert r.status_code == 409

    r = client.get("/api/sales/group-rules", headers=h)
    assert any(x["id"] == rid or x["group_name"] == "گروه الف" for x in r.json())


def test_violation_engine(client, auth_headers, db_session):
    """v2 (no right) sells g1 in the route where v1 has the exclusive right."""
    from datetime import date, timedelta

    from app.models.sales import Sale

    h = auth_headers
    v1 = _visitor(client, h, f"V1-{UID}", "علی")
    v2 = _visitor(client, h, f"V2-{UID}", "رضا")
    rid = _route(client, h, f"R1-{UID}", "مسیر ۱")
    g1 = _group(client, h, f"G1-{UID}", "گروه الف")

    r = client.post("/api/sales/group-rules", headers=h, json={"visitor_id": v1, "route_id": rid, "group_id": g1})
    assert r.status_code == 201

    today = date.today()
    db_session.add_all(
        [
            # Violation: v2 sells v1's group in v1's route (this week)
            Sale(visitor_id=v2, route_id=rid, group_id=g1, amount=100, sale_date=today),
            # Same violation but last week (out of the weekly window)
            Sale(visitor_id=v2, route_id=rid, group_id=g1, amount=50, sale_date=today - timedelta(days=10)),
            # v1 selling own group: fine
            Sale(visitor_id=v1, route_id=rid, group_id=g1, amount=70, sale_date=today),
        ]
    )
    db_session.commit()

    r = client.post("/api/sales/violations", headers=h, json={})
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    mine = [i for i in items if i["visitor_id"] == v2 and i["owner_id"] == v1]
    assert len(mine) == 1, items
    assert mine[0]["amount"] == 100.0
    assert mine[0]["route_name"] == "مسیر ۱"
    assert mine[0]["group_name"] == "گروه الف"


def test_bulk_import(client, auth_headers):
    h = auth_headers
    c1, c2 = f"BV1-{UID}", f"BV2-{UID}"
    r = client.post("/api/sales/bulk/visitors", headers=h, json={
        "rows": [
            {"code": c1, "full_name": "الف"},
            {"code": c2, "full_name": "ب"},
            {"code": c1, "full_name": "تکراری"},
            {"full_name": "بدون کد"},
        ]
    })
    assert r.status_code == 201
    body = r.json()
    assert body["created"] == 2
    assert body["skipped"] == 2


def test_auto_generated_codes(client, auth_headers):
    """Omitting the code lets the DB autoincrement id generate it (V-1, R-2, ...)."""
    h = auth_headers

    r = client.post("/api/sales/visitors", headers=h, json={"full_name": "بدون کد"})
    assert r.status_code == 201, r.text
    v = r.json()
    assert v["code"] == f"V-{v['id']}"

    r = client.post("/api/sales/routes", headers=h, json={"name": "مسیر بدون کد"})
    assert r.status_code == 201, r.text
    rt = r.json()
    assert rt["code"] == f"R-{rt['id']}"

    r = client.post("/api/sales/customers", headers=h, json={"name": "مشتری بدون کد"})
    assert r.status_code == 201, r.text
    c = r.json()
    assert c["code"] == f"C-{c['id']}"

    r = client.post("/api/sales/groups", headers=h, json={"name": "گروه بدون کد"})
    assert r.status_code == 201, r.text
    g = r.json()
    assert g["code"] == f"G-{g['id']}"

    # Explicit codes are still accepted and kept
    r = client.post("/api/sales/visitors", headers=h, json={"code": "X-1", "full_name": "کد دستی"})
    assert r.status_code == 201, r.text
    assert r.json()["code"] == "X-1"

    r = client.post("/api/sales/bulk/unknown", headers=h, json={"rows": [{"code": "x"}]})
    assert r.status_code == 404


def test_sales_requires_auth(client):
    assert client.get("/api/sales/visitors").status_code == 401
    assert client.post("/api/sales/visitors", json={"code": "x", "full_name": "y"}).status_code == 401
