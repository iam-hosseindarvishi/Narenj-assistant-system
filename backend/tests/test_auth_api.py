"""API tests: login flow, role enforcement, protected endpoints, clipboard import."""
import os

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("JWT_SECRET", "test-secret")

from app.main import app  # noqa: E402


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture()
def auth_headers(client):
    resp = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_login_success(client):
    resp = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["role"] == "admin"


def test_login_wrong_password(client):
    resp = client.post("/api/auth/login", json={"username": "admin", "password": "nope"})
    assert resp.status_code == 401


def test_me_requires_token(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_me_with_token(client, auth_headers):
    resp = client.get("/api/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["username"] == "admin"
    assert "reconciliation" in body["permissions"]


def test_permissions_admin_has_all_modules(client, auth_headers):
    from app.core.permissions import MODULES

    resp = client.get("/api/auth/me", headers=auth_headers)
    assert sorted(resp.json()["permissions"]) == sorted(MODULES)


def test_permissions_unknown_role_gets_none():
    from app.core.permissions import permissions_for_role

    assert permissions_for_role("nonexistent-role") == []


def test_refresh_flow(client):
    login = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"}).json()
    resp = client.post("/api/auth/refresh", json={"refresh_token": login["refresh_token"]})
    assert resp.status_code == 200
    assert resp.json()["access_token"]


def test_dashboard_requires_auth(client):
    resp = client.get("/api/dashboard")
    assert resp.status_code == 401


def test_dashboard_with_auth(client, auth_headers):
    resp = client.get("/api/dashboard", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert "layer1" in body and "layer3" in body


def test_templates_listed(client, auth_headers):
    resp = client.get("/api/templates", headers=auth_headers)
    assert resp.status_code == 200
    names = [t["name"] for t in resp.json()]
    assert "Bank Keshavarzi" in names
    assert "Mohkam Accounting" in names


def test_clipboard_import_endpoint(client, auth_headers):
    templates = client.get("/api/templates", headers=auth_headers).json()
    acc = next(t for t in templates if t["type"] == "accounting")
    rows = ["A\tB\tC\tD\tE"]
    for i in range(1, 4):
        rows.append(f"88{i:03d}\t1405/06/15\t10000{i}\t0\tسند دریافت(1) حواله (55500{i}) کشاورزی")
    resp = client.post("/api/files/clipboard", headers=auth_headers,
                       json={"template_id": acc["id"], "text": "\n".join(rows)})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["parsed_rows"] == 3
    assert body["file_id"] > 0


def test_upload_rejects_non_excel(client, auth_headers):
    templates = client.get("/api/templates", headers=auth_headers).json()
    bank = next(t for t in templates if t["type"] == "bank")
    resp = client.post(
        f"/api/files/upload?template_id={bank['id']}",
        headers=auth_headers,
        files={"file": ("data.txt", b"hello", "text/plain")},
    )
    assert resp.status_code == 415
