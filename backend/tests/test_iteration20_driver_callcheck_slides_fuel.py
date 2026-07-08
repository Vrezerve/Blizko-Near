"""Iteration 20 backend regression tests.

Covers:
  * POST /api/auth/callcheck/start for NEW driver phone with driver_data -> method='call'
  * POST /api/auth/callcheck/status for driver callcheck (via direct DB flip to 'confirmed')
      -> creates users doc with role='driver', name/car_model/car_number, is_activated=false
  * GET  /api/settings/public includes auth_slides, auth_slides_autoplay, auth_slides_interval,
        show_fuel_stations
  * POST /api/settings/auth-slides/upload (admin) with valid PNG -> {success, slide:{id,url,order}}
  * POST /api/settings/auth-slides/upload without token -> 401/403
  * POST /api/settings/auth-slides/upload with text/plain -> 400
  * DELETE /api/settings/auth-slides/{slide_id} -> remove + re-order remaining
  * POST /api/settings/ with show_fuel_stations=true persists; GET public reflects
"""
import os
import uuid
import io
import time
import pytest
import requests
from pymongo import MongoClient


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    raise RuntimeError("REACT_APP_BACKEND_URL is required")
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get("MONGO_URL") or "mongodb://localhost:27017"
DB_NAME = os.environ.get("DB_NAME", "test_database")


# ---------- fixtures ----------

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
    r = s.post(f"{API}/admin/login",
               json={"email": "admin@taxi.local", "password": "admin123"},
               timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module", autouse=True)
def snapshot_settings(s, admin_headers, db):
    """Snapshot & restore settings so we don't leave show_fuel_stations flipped etc."""
    r = s.get(f"{API}/settings/", headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    snap = r.json() or {}
    yield
    # Restore show_fuel_stations and slides-related fields (only ones we mutate)
    restore = {
        "show_fuel_stations": snap.get("show_fuel_stations", False),
        "auth_slides_autoplay": snap.get("auth_slides_autoplay", True),
        "auth_slides_interval": snap.get("auth_slides_interval", 5),
    }
    try:
        s.post(f"{API}/settings/", json=restore, headers=admin_headers, timeout=15)
    except Exception:
        pass


def _tiny_png_bytes():
    # 1x1 red PNG
    return bytes.fromhex(
        "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4"
        "890000000D49444154789C6360600000000200015B79E70A0000000049454E44"
        "AE426082"
    )


# ---------- 1) callcheck/start for NEW driver returns method='call' ----------

class TestDriverCallcheckStart:
    def test_new_driver_returns_call_with_driver_data(self, s, db):
        # Ensure call_verify_enabled=true
        settings = db.settings.find_one({"id": "main"}) or {}
        assert settings.get("call_verify_enabled") is True, "call_verify_enabled must be true"
        # random new phone
        suffix = str(uuid.uuid4().int)[-9:]
        phone = "+7977" + suffix[:9]  # +7977XXXXXXXXX will be 12 chars, but backend accepts full
        # keep it 12 chars: +7 + 10 digits
        phone = "+7" + "977" + suffix[:7]
        device_id = str(uuid.uuid4())
        payload = {
            "phone": phone,
            "role": "driver",
            "device_id": device_id,
            "driver_data": {
                "name": "TEST_Driver_" + suffix[:4],
                "car_model": "Toyota Camry TEST",
                "car_number": "А" + suffix[:3] + "БВ777",
                "agreed_terms": True,
                "agreed_privacy": True
            }
        }
        r = s.post(f"{API}/auth/callcheck/start", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("method") == "call", f"Expected method=call for driver, got {data}"
        assert data.get("verify_id"), "verify_id missing"
        assert data.get("call_phone"), "call_phone missing"
        assert isinstance(data.get("timeout"), int)
        # Verify DB record has driver_data + role=driver + purpose=auth (default)
        rec = db.callcheck_requests.find_one({"id": data["verify_id"]})
        assert rec is not None, "callcheck_requests row not written"
        assert rec.get("role") == "driver"
        assert rec.get("driver_data"), "driver_data must be persisted"
        assert rec["driver_data"].get("name") == payload["driver_data"]["name"]
        assert rec["driver_data"].get("car_model") == payload["driver_data"]["car_model"]
        assert rec["driver_data"].get("car_number") == payload["driver_data"]["car_number"]
        assert rec.get("status") == "waiting"
        # stash for next test
        pytest._iter20 = {"verify_id": data["verify_id"], "phone": phone, "device_id": device_id,
                          "driver_data": payload["driver_data"], "check_id": rec.get("check_id")}

    def test_confirm_driver_creates_user_with_role_driver(self, s, db):
        ctx = getattr(pytest, "_iter20", None)
        assert ctx, "prev test did not set context"
        # Simulate confirmation by flipping the callcheck record status
        # (sms.ru real API would flip check_status to 401)
        # We use direct DB update, then call /callcheck/status which will find
        # status=='confirmed' and re-issue token (server.py:964-972).
        # But 964-972 branch requires the user to already exist. To also cover
        # the "new driver creation" branch (server.py:999-1038) we instead flip
        # via the test_mode+test_confirm shortcut. Requires test_mode=true.
        settings = db.settings.find_one({"id": "main"}) or {}
        if not settings.get("test_mode", False):
            # Flip test_mode temporarily to allow test_confirm
            r0 = s.post(f"{API}/admin/login",
                        json={"email": "admin@taxi.local", "password": "admin123"},
                        timeout=15)
            tok = r0.json()["token"]
            s.post(f"{API}/settings/",
                   json={"test_mode": True},
                   headers={"Authorization": f"Bearer {tok}"},
                   timeout=15)
            restore_test_mode = False  # we set it True, need to restore to False
            _needs_restore = True
        else:
            _needs_restore = False
            restore_test_mode = True

        try:
            r = s.post(f"{API}/auth/callcheck/status",
                       json={"verify_id": ctx["verify_id"],
                             "device_id": ctx["device_id"],
                             "test_confirm": True},
                       timeout=20)
            assert r.status_code == 200, r.text
            data = r.json()
            assert data.get("status") == "confirmed", f"Expected confirmed, got {data}"
            assert data.get("token"), "token missing"
            user = data.get("user") or {}
            assert user.get("role") == "driver", f"role must be driver, got {user.get('role')}"
            assert user.get("phone") == ctx["phone"]
            assert user.get("name") == ctx["driver_data"]["name"]
            assert user.get("car_model") == ctx["driver_data"]["car_model"]
            assert user.get("car_number") == ctx["driver_data"]["car_number"]
            assert user.get("is_activated") is False, "New driver must NOT be activated"
            # Verify DB row
            db_user = db.users.find_one({"phone": ctx["phone"], "role": "driver"})
            assert db_user is not None
            assert db_user.get("is_activated") is False
            assert db_user.get("name") == ctx["driver_data"]["name"]
            # cleanup: delete the created test driver + callcheck row
            db.users.delete_one({"id": db_user["id"]})
            db.callcheck_requests.delete_one({"id": ctx["verify_id"]})
        finally:
            # Restore test_mode to original value
            if _needs_restore:
                r0 = s.post(f"{API}/admin/login",
                            json={"email": "admin@taxi.local", "password": "admin123"},
                            timeout=15)
                tok = r0.json()["token"]
                s.post(f"{API}/settings/",
                       json={"test_mode": False},
                       headers={"Authorization": f"Bearer {tok}"},
                       timeout=15)


# ---------- 2) settings/public includes new fields ----------

class TestPublicSettingsHasNewFields:
    def test_public_settings_shape(self, s):
        r = s.get(f"{API}/settings/public", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "auth_slides" in data, "auth_slides missing in public settings"
        assert isinstance(data["auth_slides"], list)
        assert "auth_slides_autoplay" in data
        assert isinstance(data["auth_slides_autoplay"], bool)
        assert "auth_slides_interval" in data
        assert isinstance(data["auth_slides_interval"], int)
        assert "show_fuel_stations" in data
        assert isinstance(data["show_fuel_stations"], bool)


# ---------- 3) auth-slides upload/delete ----------

class TestAuthSlides:
    def test_upload_without_token_denied(self, s):
        files = {"file": ("test.png", _tiny_png_bytes(), "image/png")}
        r = s.post(f"{API}/settings/auth-slides/upload", files=files, timeout=20)
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}: {r.text}"

    def test_upload_bad_content_type_400(self, s, admin_headers):
        files = {"file": ("test.txt", b"hello world", "text/plain")}
        r = s.post(f"{API}/settings/auth-slides/upload",
                   headers=admin_headers, files=files, timeout=20)
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"

    def test_upload_ok_returns_slide(self, s, admin_headers, db):
        files = {"file": ("TEST_slide.png", _tiny_png_bytes(), "image/png")}
        r = s.post(f"{API}/settings/auth-slides/upload",
                   headers=admin_headers, files=files, timeout=25)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True
        slide = data.get("slide") or {}
        assert slide.get("id"), "slide id missing"
        assert slide.get("url", "").startswith("/api/uploads/"), f"unexpected url: {slide.get('url')}"
        assert isinstance(slide.get("order"), int)
        # confirm it lands in settings.auth_slides
        settings = db.settings.find_one({"id": "main"}) or {}
        slide_ids = [s2.get("id") for s2 in settings.get("auth_slides", [])]
        assert slide["id"] in slide_ids
        pytest._iter20_slide_id = slide["id"]

    def test_delete_slide_reorders_remaining(self, s, admin_headers, db):
        slide_id = getattr(pytest, "_iter20_slide_id", None)
        assert slide_id, "upload test must run first"
        r = s.delete(f"{API}/settings/auth-slides/{slide_id}",
                     headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        settings = db.settings.find_one({"id": "main"}) or {}
        remaining = settings.get("auth_slides", [])
        assert all(s2.get("id") != slide_id for s2 in remaining), "deleted slide still present"
        # order must be 0..N-1
        orders = sorted([s2.get("order") for s2 in remaining])
        assert orders == list(range(len(remaining))), f"orders not sequential: {orders}"


# ---------- 4) show_fuel_stations round-trip ----------

class TestShowFuelStationsRoundTrip:
    def test_set_true_then_public_reflects(self, s, admin_headers):
        r = s.post(f"{API}/settings/",
                   json={"show_fuel_stations": True},
                   headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        # public
        rp = s.get(f"{API}/settings/public", timeout=15)
        assert rp.status_code == 200
        assert rp.json().get("show_fuel_stations") is True

    def test_set_false_then_public_reflects(self, s, admin_headers):
        r = s.post(f"{API}/settings/",
                   json={"show_fuel_stations": False},
                   headers=admin_headers, timeout=15)
        assert r.status_code == 200
        rp = s.get(f"{API}/settings/public", timeout=15)
        assert rp.json().get("show_fuel_stations") is False
