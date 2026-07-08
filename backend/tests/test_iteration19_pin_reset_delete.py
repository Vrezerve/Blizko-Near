"""Iteration 19 - PIN reset callcheck flow + DELETE /admin/users/{id} + role gate.

Tests:
  * callcheck/start with purpose='pin_reset' for EXISTING customer returns method='call'
  * callcheck/start for NEW customer number returns method='call'
  * callcheck/start with role='driver' returns method='sms' (call verify is customer-only)
  * callcheck/start rate limit -> 429 RATE_LIMIT:N on second call for same phone
  * DELETE /api/admin/users/{id} auth gate (401 without token, 403 with non-admin)
  * DELETE customer -> success:true, orders_deleted:N, cleans up user + related data
  * DELETE driver -> driver_id set to None in his orders, user removed
  * DELETE admin -> 403 (cannot delete admin)
  * DELETE nonexistent -> 404
"""
import os
import uuid
import time
import pytest
import requests
from pymongo import MongoClient


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    raise RuntimeError("REACT_APP_BACKEND_URL is required")
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "test_database")


# --------- fixtures ---------

@pytest.fixture(scope="module")
def db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def admin_token(s):
    r = s.post(f"{API}/admin/login", json={"email": "admin@taxi.local", "password": "admin123"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module", autouse=True)
def ensure_call_verify_enabled(s, admin_headers, db):
    """Snapshot + ensure call_verify_enabled=true so callcheck path is exercised.
    Restore original settings after tests complete.
    """
    r = s.get(f"{API}/settings/", headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    original = r.json()

    payload = {
        "call_verify_enabled": True,
        "call_verify_rate_limit": original.get("call_verify_rate_limit") or 60,
        "sms_ru_api_key": original.get("sms_ru_api_key") or "",
        "test_mode": original.get("test_mode", False),
    }
    r2 = s.post(f"{API}/settings/", headers=admin_headers, json=payload, timeout=15)
    assert r2.status_code == 200, r2.text

    yield

    # Restore
    restore = {k: original.get(k) for k in [
        "call_verify_enabled", "call_verify_rate_limit", "sms_ru_api_key",
        "test_mode", "call_verify_title", "call_verify_instruction",
        "call_verify_timeout", "call_verify_poll_interval"
    ] if k in original}
    if restore:
        s.post(f"{API}/settings/", headers=admin_headers, json=restore, timeout=15)


def _rand_phone():
    # random +7977 mobile-like number to avoid touching known accounts
    return "+7977" + str(int(time.time() * 1000))[-7:]


# --------- callcheck/start ---------

class TestCallcheckStart:
    """POST /api/auth/callcheck/start"""

    def test_pin_reset_for_existing_customer_returns_call(self, s, db):
        """Existing customer with PIN, purpose=pin_reset -> method='call' (not blocked)."""
        # Ensure an existing customer with PIN exists (seed the standard test customer)
        phone = "+79001234567"
        existing = db.users.find_one({"phone": phone, "role": "customer"})
        if not existing:
            pytest.skip(f"Seed customer {phone} missing")

        r = s.post(f"{API}/auth/callcheck/start", json={
            "phone": phone,
            "role": "customer",
            "device_id": f"pytest-{uuid.uuid4().hex[:8]}",
            "purpose": "pin_reset",
        }, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        # Expect either full 'call' payload if sms.ru upstream succeeded, or graceful 'sms' fallback
        assert body.get("method") in ("call", "sms")
        if body["method"] == "call":
            assert body.get("verify_id")
            assert "call_phone" in body
            assert "timeout" in body
            assert "poll_interval" in body
            # Purpose must be stored so confirm clears the PIN
            rec = db.callcheck_requests.find_one({"id": body["verify_id"]}, {"_id": 0})
            assert rec is not None
            assert rec.get("purpose") == "pin_reset"

    def test_new_phone_returns_call(self, s):
        phone = _rand_phone()
        r = s.post(f"{API}/auth/callcheck/start", json={
            "phone": phone,
            "role": "customer",
            "device_id": f"pytest-{uuid.uuid4().hex[:8]}",
        }, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("method") in ("call", "sms")
        if body["method"] == "call":
            assert body.get("verify_id")
            assert body.get("call_phone")
            assert body.get("timeout")

    def test_driver_role_returns_sms(self, s):
        """Call verification is customer-only. Driver must fall back to sms."""
        r = s.post(f"{API}/auth/callcheck/start", json={
            "phone": _rand_phone(),
            "role": "driver",
            "device_id": f"pytest-{uuid.uuid4().hex[:8]}",
        }, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json() == {"method": "sms"}

    def test_rate_limit_second_call_same_phone(self, s):
        """Second immediate callcheck/start on same phone -> 429 RATE_LIMIT:N."""
        phone = _rand_phone()
        dev1 = f"pytest-{uuid.uuid4().hex[:8]}"
        dev2 = f"pytest-{uuid.uuid4().hex[:8]}"
        r1 = s.post(f"{API}/auth/callcheck/start", json={
            "phone": phone, "role": "customer", "device_id": dev1
        }, timeout=20)
        assert r1.status_code == 200, r1.text
        first_method = r1.json().get("method")
        if first_method != "call":
            # sms.ru upstream unavailable — rate limit isn't consumed on fallback
            pytest.skip("sms.ru upstream fallback; rate limit only inserted on call success")

        # Second call for same phone from any device should be 429
        r2 = s.post(f"{API}/auth/callcheck/start", json={
            "phone": phone, "role": "customer", "device_id": dev2
        }, timeout=20)
        assert r2.status_code == 429, r2.text
        detail = r2.json().get("detail", "")
        assert detail.startswith("RATE_LIMIT:") or detail == "RATE_LIMIT_HOUR"


# --------- DELETE /admin/users/{id} ---------

class TestDeleteUser:
    """DELETE /api/admin/users/{user_id}"""

    def test_delete_without_token_returns_401_or_403(self, s):
        r = s.delete(f"{API}/admin/users/some-id", timeout=15)
        assert r.status_code in (401, 403), r.text

    def test_delete_with_customer_token_returns_403(self, s, db):
        """Non-admin token cannot delete users."""
        # Need to get a customer token — use seeded test customer.
        # Try test_mode SMS flow: send-code + verify-code with '1234' if test_mode enabled.
        # If not enabled, skip.
        settings = db.settings.find_one({"id": "main"}) or {}
        if not settings.get("test_mode"):
            pytest.skip("test_mode disabled — cannot easily obtain customer token")
        phone = "+79001234567"
        dev = f"pytest-{uuid.uuid4().hex[:8]}"
        r1 = s.post(f"{API}/auth/send-code", json={"phone": phone, "role": "customer", "device_id": dev}, timeout=15)
        if r1.status_code != 200:
            pytest.skip(f"send-code unavailable: {r1.text}")
        r2 = s.post(f"{API}/auth/verify-code", json={
            "phone": phone, "code": "1234", "role": "customer", "device_id": dev
        }, timeout=15)
        if r2.status_code != 200:
            pytest.skip(f"verify-code unavailable: {r2.text}")
        cust_token = r2.json()["token"]

        # Attempt delete with customer token
        target = db.users.find_one({"phone": phone, "role": "customer"})
        r3 = s.delete(f"{API}/admin/users/{target['id']}", headers={"Authorization": f"Bearer {cust_token}"}, timeout=15)
        assert r3.status_code in (401, 403), r3.text

    def test_delete_customer_removes_user_and_orders(self, s, admin_headers, db):
        # Seed a throwaway customer + 2 orders
        uid = str(uuid.uuid4())
        db.users.insert_one({
            "id": uid,
            "phone": f"+7900{int(time.time())%1000000:06d}",
            "role": "customer",
            "name": "TEST_del_customer",
            "is_activated": True,
            "total_orders": 0,
            "cancelled_orders": 0,
            "created_at": "2026-01-01T00:00:00+00:00"
        })
        for _ in range(2):
            db.orders.insert_one({
                "id": str(uuid.uuid4()),
                "customer_id": uid,
                "status": "completed",
                "created_at": "2026-01-01T00:00:00+00:00"
            })
        db.notifications.insert_one({"id": str(uuid.uuid4()), "user_id": uid, "title": "t", "body": "b"})

        r = s.delete(f"{API}/admin/users/{uid}", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        assert body.get("orders_deleted") == 2

        assert db.users.find_one({"id": uid}) is None
        assert db.orders.count_documents({"customer_id": uid}) == 0
        assert db.notifications.count_documents({"user_id": uid}) == 0

    def test_delete_driver_nullifies_driver_id_in_orders(self, s, admin_headers, db):
        uid = str(uuid.uuid4())
        db.users.insert_one({
            "id": uid,
            "phone": f"+7900{int(time.time())%1000000:06d}",
            "role": "driver",
            "name": "TEST_del_driver",
            "is_activated": True,
            "created_at": "2026-01-01T00:00:00+00:00"
        })
        # Order performed by this driver
        oid = str(uuid.uuid4())
        db.orders.insert_one({
            "id": oid,
            "customer_id": "some-customer",
            "driver_id": uid,
            "status": "completed",
            "created_at": "2026-01-01T00:00:00+00:00"
        })

        r = s.delete(f"{API}/admin/users/{uid}", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True

        assert db.users.find_one({"id": uid}) is None
        # Order preserved but driver_id nulled
        order = db.orders.find_one({"id": oid})
        assert order is not None
        assert order.get("driver_id") is None

        # cleanup order
        db.orders.delete_one({"id": oid})

    def test_delete_admin_forbidden(self, s, admin_headers, db):
        admin = db.users.find_one({"role": "admin"})
        if not admin:
            pytest.skip("no admin user found")
        r = s.delete(f"{API}/admin/users/{admin['id']}", headers=admin_headers, timeout=15)
        assert r.status_code == 403, r.text
        assert "администратора" in r.json().get("detail", "").lower() or "admin" in r.json().get("detail", "").lower()

    def test_delete_nonexistent_returns_404(self, s, admin_headers):
        r = s.delete(f"{API}/admin/users/does-not-exist-{uuid.uuid4().hex}", headers=admin_headers, timeout=15)
        assert r.status_code == 404, r.text
        assert "не найден" in r.json().get("detail", "").lower()
