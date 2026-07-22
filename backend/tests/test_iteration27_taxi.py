"""
Iteration 27 backend tests
Covers:
 - Public settings new fields (seo_title, seo_description, ui_texts, address_suggestions_enabled)
 - POST /api/settings/ persistence of ui_texts / seo / address_suggestions / order_auto_cancel_minutes
 - POST /api/logs/client (no auth)
 - POST /api/orders/create with empty / missing house_number
 - Auto-cancel: expire_stale_pending_orders through GET /api/orders/my-active
 - my-active returns recently finished order for ~3 min then {"status":"none"}
 - GET /api/drivers/stats — online only if last_seen_at within 120s; heartbeat via GET /api/orders/active
 - E2E: customer creates -> driver sees -> accept -> customer my-active shows accepted with driver_name -> complete -> shows completed
"""
import os
import time
import uuid
import jwt
import pytest
import requests
from datetime import datetime, timedelta, timezone
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://order-sync-platform-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# Mongo direct access for setup / teardown
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
JWT_SECRET = os.environ.get("JWT_SECRET", "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6")

ADMIN_EMAIL = "admin@taxi.local"
ADMIN_PASSWORD = "admin123"

TEST_CUSTOMER_PHONE = "+79001234567"
TEST_DRIVER_PHONE = "+79007654321"


def doc_customer_id(mongo):
    u = mongo.users.find_one({"phone": TEST_CUSTOMER_PHONE, "role": "customer"})
    return u["id"] if u else None


@pytest.fixture(scope="module")
def mongo():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


def _get_or_create_user_via_sms(phone: str, role: str):
    """Uses test_mode SMS flow. Returns token."""
    device_id = f"TESTDEV_{uuid.uuid4().hex[:16]}"
    r = requests.post(
        f"{API}/auth/send-code",
        json={"phone": phone, "role": role, "device_id": device_id},
        timeout=15,
    )
    assert r.status_code == 200, f"send-code failed for {phone}: {r.text}"
    r = requests.post(
        f"{API}/auth/verify-code",
        json={"phone": phone, "code": "1234", "role": role, "device_id": device_id},
        timeout=15,
    )
    assert r.status_code == 200, f"verify-code failed for {phone}: {r.text}"
    return r.json()["token"]


def _jwt_for_user(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=6),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


@pytest.fixture(scope="module")
def customer_token(mongo):
    # Try SMS flow. If fails (rate limit / device blocked / etc), fallback to direct JWT.
    try:
        return _get_or_create_user_via_sms(TEST_CUSTOMER_PHONE, "customer")
    except AssertionError:
        u = mongo.users.find_one({"phone": TEST_CUSTOMER_PHONE, "role": "customer"})
        if not u:
            uid = str(uuid.uuid4())
            mongo.users.insert_one({
                "id": uid,
                "phone": TEST_CUSTOMER_PHONE,
                "role": "customer",
                "name": "TEST Customer Iter27",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        else:
            uid = u["id"]
        return _jwt_for_user(uid, "customer")


@pytest.fixture(scope="module")
def customer_headers(customer_token):
    return {"Authorization": f"Bearer {customer_token}"}


@pytest.fixture(scope="module")
def driver_token(mongo):
    try:
        tok = _get_or_create_user_via_sms(TEST_DRIVER_PHONE, "driver")
    except AssertionError:
        u = mongo.users.find_one({"phone": TEST_DRIVER_PHONE, "role": "driver"})
        if not u:
            uid = str(uuid.uuid4())
            mongo.users.insert_one({
                "id": uid,
                "phone": TEST_DRIVER_PHONE,
                "role": "driver",
                "name": "TEST Driver Iter27",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        else:
            uid = u["id"]
        tok = _jwt_for_user(uid, "driver")
    # Ensure driver activated, online, not busy
    mongo.users.update_one(
        {"phone": TEST_DRIVER_PHONE, "role": "driver"},
        {"$set": {
            "is_activated": True,
            "is_online": True,
            "is_busy": False,
            "last_seen_at": datetime.now(timezone.utc).isoformat(),
            "name": "TEST Driver Iter27",
            "car_model": "Lada Vesta",
            "car_number": "A123BC77",
        }}
    )
    return tok


@pytest.fixture(scope="module")
def driver_headers(driver_token):
    return {"Authorization": f"Bearer {driver_token}"}


# -------- Public settings ---------
class TestPublicSettings:
    def test_public_returns_new_fields(self):
        r = requests.get(f"{API}/settings/public", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "seo_title" in d
        assert "seo_description" in d
        assert "ui_texts" in d and isinstance(d["ui_texts"], dict)
        assert "address_suggestions_enabled" in d
        assert isinstance(d["address_suggestions_enabled"], bool)


# -------- Admin settings POST persistence ---------
class TestAdminSettingsPersistence:
    def test_post_new_fields_persist(self, admin_headers):
        payload = {
            "seo_title": "SEO_TITLE_ITER27",
            "seo_description": "SEO_DESC_ITER27",
            "ui_texts": {"searching_title": "TEST_SEARCHING_TXT_ITER27"},
            "address_suggestions_enabled": True,
            "order_auto_cancel_minutes": 17,
        }
        r = requests.post(f"{API}/settings/", json=payload, headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        # verify via public
        pub = requests.get(f"{API}/settings/public", timeout=15).json()
        assert pub["seo_title"] == "SEO_TITLE_ITER27", f"seo_title not persisted: {pub['seo_title']!r}"
        assert pub["seo_description"] == "SEO_DESC_ITER27"
        assert pub["ui_texts"].get("searching_title") == "TEST_SEARCHING_TXT_ITER27"
        assert pub["address_suggestions_enabled"] is True
        # verify admin-side
        admin_get = requests.get(f"{API}/settings/", headers=admin_headers, timeout=15).json()
        assert admin_get.get("order_auto_cancel_minutes") == 17, \
            f"order_auto_cancel_minutes not persisted: {admin_get.get('order_auto_cancel_minutes')!r}"

    def test_reset_new_fields(self, admin_headers):
        # Reset to safe defaults so other tests don't get affected
        payload = {
            "seo_title": "",
            "seo_description": "",
            "ui_texts": {},
            "address_suggestions_enabled": False,
            "order_auto_cancel_minutes": 15,
        }
        r = requests.post(f"{API}/settings/", json=payload, headers=admin_headers, timeout=15)
        assert r.status_code == 200


# -------- Client browser logs endpoint ---------
class TestClientLogs:
    def test_post_client_log_no_auth(self, admin_headers):
        marker = f"TEST_ITER27_BROWSER_{uuid.uuid4().hex[:8]}"
        r = requests.post(
            f"{API}/logs/client",
            json={"level": "error", "message": marker, "url": "/x", "ua": "UA-test"},
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json().get("success") is True

        # verify it appears in admin system-logs with source=browser
        r = requests.get(f"{API}/admin/system-logs", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        logs = r.json()
        matches = [l for l in logs if l.get("message") == marker]
        assert matches, "browser log not found in system-logs"
        assert matches[0].get("source") == "browser"
        assert matches[0].get("level") == "error"


# -------- Order create with empty house_number ---------
class TestOrderCreateHouseNumber:
    def _cancel_any_active(self, customer_headers, mongo=None):
        try:
            r = requests.get(f"{API}/orders/my-active", headers=customer_headers, timeout=15)
            if r.status_code == 200 and r.json().get("id") and r.json().get("status") in ("pending", "accepted"):
                requests.post(f"{API}/orders/cancel/{r.json()['id']}", headers=customer_headers, timeout=15)
        except Exception:
            pass
        # Clear any BLOCKED cooldown from prior test runs
        if mongo is not None:
            cid = doc_customer_id(mongo)
            if cid:
                old = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
                mongo.orders.update_many(
                    {"customer_id": cid, "cancelled_by": "customer_after_accept"},
                    {"$set": {"cancelled_at": old}}
                )

    def test_create_order_empty_house_number(self, customer_headers, mongo):
        self._cancel_any_active(customer_headers, mongo)
        r = requests.post(
            f"{API}/orders/create",
            json={"address": "TEST_ITER27_addr1", "house_number": ""},
            headers=customer_headers,
            timeout=15,
        )
        assert r.status_code == 200, r.text
        order = r.json()
        assert order.get("address") == "TEST_ITER27_addr1"
        # cleanup
        requests.post(f"{API}/orders/cancel/{order['id']}", headers=customer_headers, timeout=15)

    def test_create_order_missing_house_number(self, customer_headers, mongo):
        self._cancel_any_active(customer_headers, mongo)
        r = requests.post(
            f"{API}/orders/create",
            json={"address": "TEST_ITER27_addr2"},
            headers=customer_headers,
            timeout=15,
        )
        assert r.status_code == 200, r.text
        order = r.json()
        assert order.get("address") == "TEST_ITER27_addr2"
        requests.post(f"{API}/orders/cancel/{order['id']}", headers=customer_headers, timeout=15)


# -------- Auto-cancel of stale pending orders ---------
class TestAutoCancel:
    def test_auto_cancel_via_backdated_created_at(self, customer_headers, mongo, admin_headers):
        # Ensure the auto-cancel window is a positive small number (15 default is fine, we backdate 20 min)
        requests.post(f"{API}/settings/", json={"order_auto_cancel_minutes": 15}, headers=admin_headers, timeout=15)

        # cancel any active
        r = requests.get(f"{API}/orders/my-active", headers=customer_headers, timeout=15)
        if r.status_code == 200 and r.json().get("id"):
            requests.post(f"{API}/orders/cancel/{r.json()['id']}", headers=customer_headers, timeout=15)

        # create fresh order
        r = requests.post(
            f"{API}/orders/create",
            json={"address": "TEST_ITER27_stale"},
            headers=customer_headers,
            timeout=15,
        )
        assert r.status_code == 200, r.text
        order_id = r.json()["id"]

        # backdate created_at to 20 minutes ago
        backdate = (datetime.now(timezone.utc) - timedelta(minutes=20)).isoformat()
        mongo.orders.update_one({"id": order_id}, {"$set": {"created_at": backdate}})

        # trigger via my-active
        r = requests.get(f"{API}/orders/my-active", headers=customer_headers, timeout=15)
        assert r.status_code == 200
        # The order should now be cancelled by timeout — my-active may return either
        # the recently finished order (within 3 min window) or {"status": "none"}.
        # Regardless — verify in DB:
        doc = mongo.orders.find_one({"id": order_id}, {"_id": 0})
        assert doc is not None
        assert doc.get("status") == "cancelled", f"expected cancelled, got {doc.get('status')}"
        assert doc.get("cancelled_by") == "timeout", f"expected cancelled_by=timeout, got {doc.get('cancelled_by')}"


# -------- my-active returns recently finished order ---------
class TestMyActiveRecent:
    def test_recently_finished_included_then_expires(self, customer_headers, mongo):
        # Create + immediately cancel
        # First clear any existing
        r = requests.get(f"{API}/orders/my-active", headers=customer_headers, timeout=15)
        if r.status_code == 200 and r.json().get("id") and r.json().get("status") in ("pending", "accepted"):
            requests.post(f"{API}/orders/cancel/{r.json()['id']}", headers=customer_headers, timeout=15)

        r = requests.post(
            f"{API}/orders/create",
            json={"address": "TEST_ITER27_recent"},
            headers=customer_headers,
            timeout=15,
        )
        assert r.status_code == 200
        oid = r.json()["id"]
        r = requests.post(f"{API}/orders/cancel/{oid}", headers=customer_headers, timeout=15)
        assert r.status_code == 200

        # my-active should still show this cancelled order (<3 min old)
        r = requests.get(f"{API}/orders/my-active", headers=customer_headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d.get("id") == oid, f"expected recent cancelled order to be returned; got {d}"
        assert d.get("status") == "cancelled"

        # simulate >3 min old by backdating ALL cancelled orders for this customer
        old = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
        mongo.orders.update_many(
            {"customer_id": doc_customer_id(mongo), "status": {"$in": ["cancelled", "completed", "problem"]}},
            {"$set": {"cancelled_at": old, "completed_at": old, "created_at": old}}
        )
        r = requests.get(f"{API}/orders/my-active", headers=customer_headers, timeout=15)
        assert r.status_code == 200
        assert r.json() == {"status": "none"}, f"expected status=none after expiry, got {r.json()}"


# -------- Driver stats + heartbeat ---------
class TestDriverStatsHeartbeat:
    def test_stats_excludes_stale_online(self, driver_token, driver_headers, mongo):
        # Set driver's last_seen_at very old (>120s) with is_online=true
        very_old = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
        mongo.users.update_one(
            {"phone": TEST_DRIVER_PHONE, "role": "driver"},
            {"$set": {"is_online": True, "is_activated": True, "last_seen_at": very_old}}
        )
        r = requests.get(f"{API}/drivers/stats", timeout=15)
        assert r.status_code == 200
        stale_online = r.json()["online"]

        # Now trigger heartbeat via GET /api/orders/active (as driver)
        r = requests.get(f"{API}/orders/active", headers=driver_headers, timeout=15)
        assert r.status_code == 200

        # last_seen_at should now be recent
        doc = mongo.users.find_one({"phone": TEST_DRIVER_PHONE, "role": "driver"}, {"_id": 0, "last_seen_at": 1})
        ls = datetime.fromisoformat(doc["last_seen_at"])
        assert (datetime.now(timezone.utc) - ls).total_seconds() < 30

        r = requests.get(f"{API}/drivers/stats", timeout=15)
        assert r.status_code == 200
        fresh_online = r.json()["online"]
        assert fresh_online >= stale_online + 1, \
            f"expected online count to grow after heartbeat; stale={stale_online}, fresh={fresh_online}"


# -------- E2E: create -> accept -> complete ---------
class TestE2EOrderFlow:
    def test_full_flow(self, customer_headers, driver_headers, driver_token, mongo):
        # Ensure clean state
        r = requests.get(f"{API}/orders/my-active", headers=customer_headers, timeout=15)
        if r.status_code == 200 and r.json().get("id") and r.json().get("status") in ("pending", "accepted"):
            requests.post(f"{API}/orders/cancel/{r.json()['id']}", headers=customer_headers, timeout=15)

        # Make sure driver is online + not busy + activated + recent heartbeat
        mongo.users.update_one(
            {"phone": TEST_DRIVER_PHONE, "role": "driver"},
            {"$set": {
                "is_activated": True,
                "is_online": True,
                "is_busy": False,
                "last_seen_at": datetime.now(timezone.utc).isoformat(),
            }}
        )

        # 1) customer creates
        r = requests.post(
            f"{API}/orders/create",
            json={"address": "TEST_ITER27_e2e"},
            headers=customer_headers,
            timeout=15,
        )
        assert r.status_code == 200, r.text
        order_id = r.json()["id"]

        # 2) driver sees it in /orders/active
        r = requests.get(f"{API}/orders/active", headers=driver_headers, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("current_order") is None
        oids = [o["id"] for o in d.get("available_orders", [])]
        assert order_id in oids, f"driver doesn't see order {order_id}; got {oids}"

        # 3) driver accepts
        r = requests.post(f"{API}/orders/accept/{order_id}", headers=driver_headers, timeout=15)
        assert r.status_code == 200, r.text

        # 4) customer my-active shows accepted + driver_name
        r = requests.get(f"{API}/orders/my-active", headers=customer_headers, timeout=15)
        assert r.status_code == 200
        o = r.json()
        assert o.get("status") == "accepted", f"expected accepted, got {o.get('status')}"
        assert o.get("driver_name"), "driver_name missing in my-active response"

        # backdate accepted_at to bypass 2-minute minimum before complete
        old_accepted = (datetime.now(timezone.utc) - timedelta(minutes=3)).isoformat()
        mongo.orders.update_one({"id": order_id}, {"$set": {"accepted_at": old_accepted}})

        # 5) driver completes
        r = requests.post(f"{API}/orders/complete/{order_id}", headers=driver_headers, timeout=15)
        assert r.status_code == 200, r.text

        # 6) customer my-active shows completed
        r = requests.get(f"{API}/orders/my-active", headers=customer_headers, timeout=15)
        assert r.status_code == 200
        o = r.json()
        assert o.get("status") == "completed", f"expected completed, got {o}"

        # cleanup: reset driver busy flag just in case
        mongo.users.update_one(
            {"phone": TEST_DRIVER_PHONE, "role": "driver"},
            {"$set": {"is_busy": False}}
        )
