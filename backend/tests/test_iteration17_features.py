"""
Iteration 17 backend tests:
  - GET /api/manifest.json
  - GET /api/settings/public new fields
  - Admin settings save/read (map, PWA, call verify fields)
  - POST /api/settings/upload-pwa-icon
  - POST /api/auth/callcheck/start / status behavior with rate limiting bypass via toggles
  - Regression: normal SMS flow /auth/send-code + /auth/verify-code
"""
import io
import os
import time
import uuid
import pytest
import requests

def _load_frontend_env():
    val = os.environ.get("REACT_APP_BACKEND_URL", "")
    if val:
        return val.rstrip("/")
    # fall back to reading /app/frontend/.env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                line = line.strip()
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().strip('"').rstrip("/")
    except Exception:
        pass
    return ""

BASE_URL = _load_frontend_env()
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"

ADMIN_EMAIL = "admin@taxi.local"
ADMIN_PASSWORD = "admin123"


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(http):
    r = http.post(f"{BASE_URL}/api/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    token = r.json().get("token")
    assert token
    return token


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def original_settings(http, admin_headers):
    """Snapshot admin settings before mutating; restored at teardown."""
    r = requests.get(f"{BASE_URL}/api/settings/", headers={"Authorization": admin_headers["Authorization"]})
    assert r.status_code == 200, r.text
    snap = r.json()
    yield snap
    # ---- teardown: restore only the fields we mutate ----
    restore = {
        "map_enabled": snap.get("map_enabled", True),
        "map_bg_repeat": snap.get("map_bg_repeat", "no-repeat"),
        "pwa_enabled": snap.get("pwa_enabled", True),
        "pwa_short_name": snap.get("pwa_short_name", ""),
        "pwa_prompt_text": snap.get("pwa_prompt_text", ""),
        "call_verify_enabled": snap.get("call_verify_enabled", False),
        "call_verify_title": snap.get("call_verify_title", ""),
        "call_verify_instruction": snap.get("call_verify_instruction", ""),
        "call_verify_timeout": snap.get("call_verify_timeout", 300),
        "call_verify_poll_interval": snap.get("call_verify_poll_interval", 3),
        "call_verify_rate_limit": snap.get("call_verify_rate_limit", 60),
        "test_mode": snap.get("test_mode", True),
    }
    requests.post(f"{BASE_URL}/api/settings/", json=restore, headers=admin_headers)


# ---------- Public manifest ----------
class TestManifest:
    def test_manifest_returns_valid_json(self, http):
        r = http.get(f"{BASE_URL}/api/manifest.json")
        assert r.status_code == 200, r.text
        m = r.json()
        for k in ("name", "short_name", "start_url", "display", "icons"):
            assert k in m, f"missing {k}"
        assert m["display"] == "standalone"
        assert m["start_url"] == "/"
        assert isinstance(m["icons"], list)


# ---------- Public settings ----------
class TestPublicSettings:
    def test_public_settings_has_new_fields(self, http):
        r = http.get(f"{BASE_URL}/api/settings/public")
        assert r.status_code == 200, r.text
        d = r.json()
        expected = [
            "map_enabled", "map_bg_repeat",
            "pwa_enabled", "pwa_short_name", "pwa_prompt_text",
            "pwa_icon_192_url",
            "call_verify_enabled",
        ]
        for k in expected:
            assert k in d, f"public settings missing key: {k}"


# ---------- Admin settings save/read ----------
class TestAdminSettingsSave:
    def test_admin_can_save_and_read_new_fields(self, http, admin_headers, original_settings):
        unique_short = f"РЯД{uuid.uuid4().hex[:4]}"
        payload = {
            "map_enabled": False,
            "map_bg_repeat": "repeat",
            "pwa_enabled": True,
            "pwa_short_name": unique_short,
            "pwa_prompt_text": "Установите приложение",
            "call_verify_enabled": True,
            "call_verify_title": "Подтвердите",
            "call_verify_instruction": "Позвоните на {phone}",
            "call_verify_timeout": 240,
            "call_verify_poll_interval": 4,
            "call_verify_rate_limit": 45,
        }
        r = http.post(f"{BASE_URL}/api/settings/", json=payload, headers=admin_headers)
        assert r.status_code == 200, r.text
        assert r.json().get("success") is True

        # verify persisted
        r2 = requests.get(f"{BASE_URL}/api/settings/", headers={"Authorization": admin_headers["Authorization"]})
        assert r2.status_code == 200
        s = r2.json()
        for k, v in payload.items():
            assert s.get(k) == v, f"expected settings[{k}]={v}, got {s.get(k)}"

        # verify manifest reflects short_name
        m = requests.get(f"{BASE_URL}/api/manifest.json").json()
        assert m["short_name"] == unique_short

        # public settings reflect flags
        pub = requests.get(f"{BASE_URL}/api/settings/public").json()
        assert pub["map_enabled"] is False
        assert pub["map_bg_repeat"] == "repeat"
        assert pub["call_verify_enabled"] is True


# ---------- PWA icon upload ----------
class TestPwaIconUpload:
    def test_upload_pwa_icon_192(self, admin_headers, original_settings):
        # Minimal 1x1 PNG bytes
        png = (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
            b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8"
            b"\xcf\xc0\x00\x00\x00\x03\x00\x01\x8f\x1a\xfe\x83\x00\x00\x00\x00IEND\xaeB`\x82"
        )
        files = {"file": ("icon.png", io.BytesIO(png), "image/png")}
        data = {"size": "192"}
        r = requests.post(
            f"{BASE_URL}/api/settings/upload-pwa-icon",
            files=files, data=data,
            headers={"Authorization": admin_headers["Authorization"]},
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("success") is True
        assert j.get("url", "").startswith("/api/uploads/")

        # settings updated
        s = requests.get(f"{BASE_URL}/api/settings/", headers={"Authorization": admin_headers["Authorization"]}).json()
        assert s.get("pwa_icon_192_url") == j["url"]

        # manifest icons include it
        m = requests.get(f"{BASE_URL}/api/manifest.json").json()
        srcs = [i.get("src") for i in m.get("icons", [])]
        assert j["url"] in srcs


# ---------- Callcheck ----------
class TestCallcheck:
    def _set(self, admin_headers, **kw):
        r = requests.post(f"{BASE_URL}/api/settings/", json=kw, headers=admin_headers)
        assert r.status_code == 200, r.text

    def test_callcheck_disabled_returns_sms(self, http, admin_headers, original_settings):
        self._set(admin_headers, call_verify_enabled=False)
        r = http.post(f"{BASE_URL}/api/auth/callcheck/start", json={
            "phone": f"+7900{uuid.uuid4().hex[:7]}",
            "role": "customer",
            "device_id": f"dev-{uuid.uuid4().hex[:8]}"
        })
        assert r.status_code == 200, r.text
        assert r.json().get("method") == "sms"

    def test_callcheck_existing_user_returns_sms(self, http, admin_headers, original_settings):
        self._set(admin_headers, call_verify_enabled=True, call_verify_rate_limit=1)
        # +79001234567 is a well-known seeded customer
        r = http.post(f"{BASE_URL}/api/auth/callcheck/start", json={
            "phone": "+79001234567",
            "role": "customer",
            "device_id": f"dev-{uuid.uuid4().hex[:8]}"
        })
        assert r.status_code == 200, r.text
        assert r.json().get("method") == "sms"

    def test_callcheck_new_phone_graceful_when_upstream_fails(self, http, admin_headers, original_settings):
        # Enabled + new phone: sms.ru add likely fails (invalid api key/env) → graceful {method: sms}
        # If it actually succeeds we accept method=call as well but must not be 500.
        self._set(admin_headers, call_verify_enabled=True, call_verify_rate_limit=1)
        r = http.post(f"{BASE_URL}/api/auth/callcheck/start", json={
            "phone": f"+7999{uuid.uuid4().hex[:7]}",
            "role": "customer",
            "device_id": f"dev-{uuid.uuid4().hex[:8]}"
        })
        assert r.status_code in (200, 429), r.text  # never 500
        if r.status_code == 200:
            method = r.json().get("method")
            assert method in ("sms", "call")

    def test_callcheck_status_unknown_verify_id_404(self, http):
        r = http.post(f"{BASE_URL}/api/auth/callcheck/status", json={
            "verify_id": f"nonexistent-{uuid.uuid4().hex}",
            "device_id": "dev-x"
        })
        assert r.status_code == 404, r.text

    def test_callcheck_status_requires_verify_id(self, http):
        r = http.post(f"{BASE_URL}/api/auth/callcheck/status", json={})
        assert r.status_code == 400


# ---------- Regression: normal SMS flow ----------
class TestSmsFlowRegression:
    def test_send_code_and_verify_code_customer(self, http, admin_headers, original_settings):
        # Ensure test_mode=true to accept 1234
        requests.post(f"{BASE_URL}/api/settings/", json={"test_mode": True}, headers=admin_headers)
        phone = "+79001234567"
        device_id = f"dev-{uuid.uuid4().hex[:8]}"
        r = http.post(f"{BASE_URL}/api/auth/send-code", json={
            "phone": phone, "role": "customer", "device_id": device_id
        })
        assert r.status_code == 200, r.text
        # In test_mode the code is 1234
        r2 = http.post(f"{BASE_URL}/api/auth/verify-code", json={
            "phone": phone, "code": "1234", "role": "customer", "device_id": device_id
        })
        # Could be 200 with token, or in case PIN is set the flow may still return token (has_pin flag)
        assert r2.status_code == 200, r2.text
        body = r2.json()
        assert "token" in body or body.get("has_pin") is True
