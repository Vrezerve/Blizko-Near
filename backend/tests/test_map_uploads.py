"""Tests for map customization upload endpoints (iteration 9)
- POST /api/settings/upload-pin-icon
- POST /api/settings/upload-map-bg
- GET  /api/settings/public  (returns map_bg_image_url, map_bg_size, map_bg_position, custom_pin_url)
- POST /api/settings/ (persistence of map_bg_size / map_bg_position)
- GET  /api/uploads/{filename}  (static file serving)
"""
import io
import os
import struct
import zlib
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@taxi.local"
ADMIN_PASSWORD = "admin123"
CUSTOMER_PHONE = "+79001234567"
SMS_CODE = "1234"


# --------------------------- helpers ---------------------------

def _png_bytes(width: int = 4, height: int = 4) -> bytes:
    """Build a minimal valid PNG in memory (no Pillow needed)."""
    def chunk(tag: bytes, data: bytes) -> bytes:
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff))
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)  # 8-bit RGB
    raw = b"".join(b"\x00" + b"\xff\x00\x00" * width for _ in range(height))
    idat = zlib.compress(raw)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def _svg_bytes() -> bytes:
    return b'<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="red"/></svg>'


# --------------------------- fixtures ---------------------------

@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/admin/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def customer_token():
    """Login customer via OTP to test non-admin auth rejection."""
    device_id = "test-device-" + os.urandom(4).hex()
    r = requests.post(f"{API}/auth/send-code",
                      json={"phone": CUSTOMER_PHONE, "role": "customer", "device_id": device_id},
                      timeout=10)
    if r.status_code != 200:
        return None
    r2 = requests.post(f"{API}/auth/verify-code",
                       json={"phone": CUSTOMER_PHONE, "code": SMS_CODE,
                             "role": "customer", "device_id": device_id},
                       timeout=10)
    if r2.status_code != 200:
        return None
    return r2.json().get("token")


# --------------------------- tests: public settings ---------------------------

class TestPublicSettings:
    def test_public_settings_has_map_fields(self):
        r = requests.get(f"{API}/settings/public", timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        # required new fields
        for key in ("map_bg_image_url", "map_bg_size", "map_bg_position", "custom_pin_url"):
            assert key in data, f"missing key {key} in /settings/public"
        # default values
        assert isinstance(data["map_bg_size"], str)
        assert isinstance(data["map_bg_position"], str)


# --------------------------- tests: upload-pin-icon ---------------------------

class TestUploadPinIcon:
    def test_upload_pin_png_persists(self, admin_headers):
        files = {"file": ("pin.png", _png_bytes(), "image/png")}
        r = requests.post(f"{API}/settings/upload-pin-icon",
                          headers=admin_headers, files=files, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        assert body.get("url", "").startswith("/api/uploads/pin_icon_")
        # GET public should reflect the new pin URL
        pub = requests.get(f"{API}/settings/public", timeout=10).json()
        assert pub["custom_pin_url"] == body["url"]
        # GET admin settings
        adm = requests.get(f"{API}/settings/", headers=admin_headers, timeout=10).json()
        assert adm.get("custom_pin_url") == body["url"]
        # static file served
        fr = requests.get(f"{BASE_URL}{body['url']}", timeout=10)
        assert fr.status_code == 200
        assert fr.headers.get("content-type", "").startswith("image/")

    def test_upload_pin_svg_allowed(self, admin_headers):
        files = {"file": ("pin.svg", _svg_bytes(), "image/svg+xml")}
        r = requests.post(f"{API}/settings/upload-pin-icon",
                          headers=admin_headers, files=files, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["url"].startswith("/api/uploads/pin_icon_")

    def test_upload_pin_rejects_text(self, admin_headers):
        files = {"file": ("evil.txt", b"hello", "text/plain")}
        r = requests.post(f"{API}/settings/upload-pin-icon",
                          headers=admin_headers, files=files, timeout=10)
        assert r.status_code == 400, r.text

    def test_upload_pin_requires_admin_no_token(self):
        files = {"file": ("pin.png", _png_bytes(), "image/png")}
        r = requests.post(f"{API}/settings/upload-pin-icon", files=files, timeout=10)
        assert r.status_code in (401, 403), r.status_code

    def test_upload_pin_rejects_customer(self, customer_token):
        if not customer_token:
            pytest.skip("Customer login not available")
        files = {"file": ("pin.png", _png_bytes(), "image/png")}
        r = requests.post(f"{API}/settings/upload-pin-icon",
                          headers={"Authorization": f"Bearer {customer_token}"},
                          files=files, timeout=10)
        assert r.status_code in (401, 403), r.status_code


# --------------------------- tests: upload-map-bg ---------------------------

class TestUploadMapBg:
    def test_upload_bg_png_persists(self, admin_headers):
        files = {"file": ("bg.png", _png_bytes(8, 8), "image/png")}
        r = requests.post(f"{API}/settings/upload-map-bg",
                          headers=admin_headers, files=files, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        assert body.get("url", "").startswith("/api/uploads/map_bg_")
        # Public settings echo back
        pub = requests.get(f"{API}/settings/public", timeout=10).json()
        assert pub["map_bg_image_url"] == body["url"]
        # Static file accessible
        fr = requests.get(f"{BASE_URL}{body['url']}", timeout=10)
        assert fr.status_code == 200

    def test_upload_bg_rejects_svg(self, admin_headers):
        files = {"file": ("bg.svg", _svg_bytes(), "image/svg+xml")}
        r = requests.post(f"{API}/settings/upload-map-bg",
                          headers=admin_headers, files=files, timeout=10)
        assert r.status_code == 400, r.text

    def test_upload_bg_rejects_text(self, admin_headers):
        files = {"file": ("evil.txt", b"hello", "text/plain")}
        r = requests.post(f"{API}/settings/upload-map-bg",
                          headers=admin_headers, files=files, timeout=10)
        assert r.status_code == 400, r.text

    def test_upload_bg_requires_admin_no_token(self):
        files = {"file": ("bg.png", _png_bytes(), "image/png")}
        r = requests.post(f"{API}/settings/upload-map-bg", files=files, timeout=10)
        assert r.status_code in (401, 403), r.status_code

    def test_upload_bg_rejects_customer(self, customer_token):
        if not customer_token:
            pytest.skip("Customer login not available")
        files = {"file": ("bg.png", _png_bytes(), "image/png")}
        r = requests.post(f"{API}/settings/upload-map-bg",
                          headers={"Authorization": f"Bearer {customer_token}"},
                          files=files, timeout=10)
        assert r.status_code in (401, 403), r.status_code


# --------------------------- tests: settings persistence ---------------------------

class TestMapBgSettingsPersistence:
    def test_save_map_bg_size_and_position(self, admin_headers):
        payload = {"map_bg_size": "contain", "map_bg_position": "top left"}
        r = requests.post(f"{API}/settings/", headers=admin_headers, json=payload, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json().get("success") is True

        pub = requests.get(f"{API}/settings/public", timeout=10).json()
        assert pub["map_bg_size"] == "contain"
        assert pub["map_bg_position"] == "top left"

        # restore defaults
        requests.post(f"{API}/settings/", headers=admin_headers,
                      json={"map_bg_size": "cover", "map_bg_position": "center"}, timeout=10)
