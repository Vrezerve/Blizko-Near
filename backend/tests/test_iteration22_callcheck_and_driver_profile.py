"""
Iteration 22 backend tests:
- POST /api/auth/callcheck/start:
  * invalid Russian mobile → 400 with detail message (NOT {method:'sms'})
  * valid mobile + role=customer → {method:'call', verify_id, call_phone,...}
  * valid mobile + role=driver (no driver_data) → {method:'call', ...}
- POST /api/auth/complete-driver-profile:
  * no token → 401
  * customer token → 403
  * driver token + empty fields → 400
  * driver token + valid fields → {success:true} and DB updated
"""

import os
import time
import uuid
import pytest
import jwt as pyjwt
import requests
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://order-sync-platform-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# Mirror backend .env
JWT_SECRET = "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
JWT_ALGO = "HS256"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"


@pytest.fixture(scope="module")
def db():
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def make_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=1),
        "type": "access",
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def clear_rate_limit(db, phone):
    db.callcheck_requests.delete_many({"phone": phone})


# ============ Health check ============
def test_health_public_settings(session):
    r = session.get(f"{API}/settings/public")
    assert r.status_code == 200, r.text
    data = r.json()
    # call_verify_enabled must be true per env requirement
    assert data.get("call_verify_enabled") is True, f"call_verify_enabled expected True, got {data.get('call_verify_enabled')}"


# ============ CALLCHECK: invalid phone ============
def test_callcheck_start_invalid_phone_returns_400(db, session):
    """+73453453453 is not a valid Russian mobile — SMS.ru will reject → backend should return 400 (NOT method:'sms')"""
    phone = "+73453453453"
    clear_rate_limit(db, phone)
    r = session.post(f"{API}/auth/callcheck/start", json={
        "phone": phone,
        "role": "customer",
        "device_id": f"testdev-{uuid.uuid4().hex[:8]}",
    })
    assert r.status_code in (400, 502), f"expected 400/502, got {r.status_code} body={r.text}"
    body = r.json()
    # Must not return silent method:sms fallback
    assert body.get("method") != "sms", "backend should NOT silently fallback to SMS on sms.ru reject"
    detail = body.get("detail", "")
    assert isinstance(detail, str) and len(detail) > 0, f"empty detail: {body}"
    # Russian message
    assert ("подтверж" in detail.lower()) or ("недоступ" in detail.lower()) or ("телефон" in detail.lower()), f"unexpected detail: {detail}"


# ============ CALLCHECK: valid customer ============
def test_callcheck_start_valid_customer(db, session):
    phone = f"+7999{str(int(time.time()))[-7:]}"  # unique valid russian mobile
    clear_rate_limit(db, phone)
    r = session.post(f"{API}/auth/callcheck/start", json={
        "phone": phone,
        "role": "customer",
        "device_id": f"testdev-{uuid.uuid4().hex[:8]}",
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("method") == "call", f"expected method=call, got {body}"
    assert body.get("verify_id"), f"missing verify_id: {body}"
    assert "call_phone" in body
    assert "timeout" in body
    assert "poll_interval" in body
    # cleanup
    clear_rate_limit(db, phone)


# ============ CALLCHECK: valid driver without driver_data ============
def test_callcheck_start_valid_driver_no_data(db, session):
    phone = f"+7998{str(int(time.time())+1)[-7:]}"
    clear_rate_limit(db, phone)
    r = session.post(f"{API}/auth/callcheck/start", json={
        "phone": phone,
        "role": "driver",
        "device_id": f"testdev-{uuid.uuid4().hex[:8]}",
        # no driver_data → should NOT fail
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("method") == "call", f"driver call verify should work without driver_data, got {body}"
    assert body.get("verify_id")
    clear_rate_limit(db, phone)


# ============ complete-driver-profile: no token → 401 ============
def test_complete_driver_profile_no_token(session):
    r = requests.post(f"{API}/auth/complete-driver-profile", json={
        "name": "Test",
        "car_model": "Lada",
        "car_number": "A123AA77",
    }, headers={"Content-Type": "application/json"})
    assert r.status_code == 401, f"expected 401, got {r.status_code} body={r.text}"


# ============ complete-driver-profile: customer token → 403 ============
def test_complete_driver_profile_customer_token(db):
    customer = db.users.find_one({"role": "customer"})
    assert customer, "no customer in DB"
    token = make_token(customer["id"], "customer")
    r = requests.post(f"{API}/auth/complete-driver-profile", json={
        "name": "X", "car_model": "Y", "car_number": "Z",
    }, headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    assert r.status_code == 403, f"expected 403 for customer, got {r.status_code} body={r.text}"


# ============ complete-driver-profile: driver token + empty → 400 ============
def test_complete_driver_profile_empty_fields(db):
    driver = db.users.find_one({"role": "driver"})
    assert driver, "no driver in DB"
    token = make_token(driver["id"], "driver")
    r = requests.post(f"{API}/auth/complete-driver-profile", json={
        "name": "", "car_model": "", "car_number": "",
    }, headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    assert r.status_code == 400, f"expected 400 for empty fields, got {r.status_code} body={r.text}"


# ============ complete-driver-profile: driver token + valid → success + DB update ============
def test_complete_driver_profile_success_and_persist(db):
    # Create a temporary driver user to avoid modifying seeded data
    tmp_phone = f"+79{str(int(time.time()))[-9:]}"
    driver_id = str(uuid.uuid4())
    db.users.insert_one({
        "id": driver_id,
        "phone": tmp_phone,
        "role": "driver",
        "name": None,
        "car_model": None,
        "car_number": None,
        "is_activated": False,
        "profile_completed": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    try:
        token = make_token(driver_id, "driver")
        payload = {"name": "TEST_Driver Иван", "car_model": "TEST Lada Vesta", "car_number": "a123aa777"}
        r = requests.post(f"{API}/auth/complete-driver-profile", json=payload,
                          headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
        assert r.status_code == 200, f"expected 200, got {r.status_code} body={r.text}"
        body = r.json()
        assert body.get("success") is True, body

        # Verify DB update
        updated = db.users.find_one({"id": driver_id}, {"_id": 0})
        assert updated["name"] == "TEST_Driver Иван"
        assert updated["car_model"] == "TEST Lada Vesta"
        assert updated["car_number"] == "A123AA777"  # uppercased
        assert updated.get("profile_completed") is True
    finally:
        db.users.delete_one({"id": driver_id})
