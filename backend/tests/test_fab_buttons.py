"""Tests for FAB Buttons feature (iteration 10)
Endpoints under test:
- GET    /api/settings/fab-buttons?role={customer|driver}  (public)
- GET    /api/admin/fab-buttons                            (admin)
- POST   /api/admin/fab-buttons                            (admin, body: FabButton)
- PUT    /api/admin/fab-buttons/{id}                       (admin)
- DELETE /api/admin/fab-buttons/{id}                       (admin)
- POST   /api/admin/fab-buttons/upload-svg                 (admin, multipart svg)

Covers: CRUD, role filter (customer/driver/both), is_active filter, limit enforcement
(FAB_MAX_PER_ROLE=3), SVG upload validation, auth (anon + customer).
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@taxi.local"
ADMIN_PASSWORD = "admin123"
CUSTOMER_PHONE = "+79001234567"
SMS_CODE = "1234"


# ---------- helpers ----------

def _svg_bytes() -> bytes:
    return (
        b'<?xml version="1.0"?>'
        b'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">'
        b'<circle cx="12" cy="12" r="10" fill="blue"/></svg>'
    )


# ---------- fixtures ----------

@pytest.fixture(scope="session")
def admin_headers():
    r = requests.post(
        f"{API}/admin/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="session")
def customer_token():
    device_id = "test-device-" + os.urandom(4).hex()
    r = requests.post(
        f"{API}/auth/send-code",
        json={"phone": CUSTOMER_PHONE, "role": "customer", "device_id": device_id},
        timeout=10,
    )
    if r.status_code != 200:
        return None
    r2 = requests.post(
        f"{API}/auth/verify-code",
        json={"phone": CUSTOMER_PHONE, "code": SMS_CODE,
              "role": "customer", "device_id": device_id},
        timeout=10,
    )
    if r2.status_code != 200:
        return None
    return r2.json().get("token")


@pytest.fixture(scope="function")
def isolated_slate(admin_headers):
    """For limit tests: temporarily deactivate ALL existing active fab buttons
    so the count starts at 0, then restore them after the test."""
    r = requests.get(f"{API}/admin/fab-buttons", headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    snapshot = r.json()
    to_restore = []
    for b in snapshot:
        if b.get("is_active"):
            to_restore.append(b["id"])
            requests.put(f"{API}/admin/fab-buttons/{b['id']}",
                         headers=admin_headers, json={"is_active": False}, timeout=10)
    # also wipe any leftover TEST_ rows
    for b in snapshot:
        if (b.get("label") or "").startswith("TEST_"):
            requests.delete(f"{API}/admin/fab-buttons/{b['id']}",
                            headers=admin_headers, timeout=10)
    yield
    # cleanup TEST_ rows created during the test
    r2 = requests.get(f"{API}/admin/fab-buttons", headers=admin_headers, timeout=15)
    if r2.status_code == 200:
        for b in r2.json():
            if (b.get("label") or "").startswith("TEST_"):
                requests.delete(f"{API}/admin/fab-buttons/{b['id']}",
                                headers=admin_headers, timeout=10)
    # reactivate originals
    for bid in to_restore:
        requests.put(f"{API}/admin/fab-buttons/{bid}",
                     headers=admin_headers, json={"is_active": True}, timeout=10)


@pytest.fixture(scope="function")
def clean_slate(admin_headers):
    """Delete all existing TEST_ fab buttons before & after a test to give a clean env."""
    def _cleanup():
        r = requests.get(f"{API}/admin/fab-buttons", headers=admin_headers, timeout=15)
        if r.status_code != 200:
            return
        for btn in r.json():
            if (btn.get("label") or "").startswith("TEST_"):
                requests.delete(
                    f"{API}/admin/fab-buttons/{btn['id']}",
                    headers=admin_headers, timeout=10,
                )
    _cleanup()
    yield
    _cleanup()


def _create(headers, **overrides):
    payload = {
        "role": "customer",
        "label": "TEST_" + uuid.uuid4().hex[:6],
        "icon_svg": "<svg></svg>",
        "title": "Hello",
        "content_html": "<p>world</p>",
        "order": 0,
        "is_active": True,
    }
    payload.update(overrides)
    return requests.post(f"{API}/admin/fab-buttons",
                         headers=headers, json=payload, timeout=15)


# =================== PUBLIC ENDPOINT ===================

class TestPublicFabButtons:
    def test_public_invalid_role_400(self):
        r = requests.get(f"{API}/settings/fab-buttons", params={"role": "bogus"}, timeout=10)
        assert r.status_code == 400, r.text

    def test_public_missing_role_422(self):
        r = requests.get(f"{API}/settings/fab-buttons", timeout=10)
        # FastAPI returns 422 for missing required query param
        assert r.status_code in (400, 422), r.text

    def test_public_customer_role_returns_list(self, admin_headers, clean_slate):
        # Create one customer button
        r = _create(admin_headers, role="customer", label="TEST_pub_c")
        assert r.status_code == 200, r.text
        bid = r.json()["id"]

        r2 = requests.get(f"{API}/settings/fab-buttons", params={"role": "customer"}, timeout=10)
        assert r2.status_code == 200, r2.text
        body = r2.json()
        assert isinstance(body, list)
        labels = [b["label"] for b in body]
        assert "TEST_pub_c" in labels
        for b in body:
            assert "_id" not in b
            assert b["is_active"] is True
            assert b["role"] in ("customer", "both")
        # cleanup
        requests.delete(f"{API}/admin/fab-buttons/{bid}", headers=admin_headers, timeout=10)

    def test_role_both_visible_in_customer_and_driver(self, admin_headers, clean_slate):
        r = _create(admin_headers, role="both", label="TEST_both")
        assert r.status_code == 200, r.text
        bid = r.json()["id"]

        c = requests.get(f"{API}/settings/fab-buttons", params={"role": "customer"}, timeout=10).json()
        d = requests.get(f"{API}/settings/fab-buttons", params={"role": "driver"}, timeout=10).json()
        assert "TEST_both" in [b["label"] for b in c]
        assert "TEST_both" in [b["label"] for b in d]
        requests.delete(f"{API}/admin/fab-buttons/{bid}", headers=admin_headers, timeout=10)

    def test_inactive_buttons_hidden_from_public(self, admin_headers, clean_slate):
        r = _create(admin_headers, role="customer", label="TEST_inactive", is_active=False)
        assert r.status_code == 200, r.text
        bid = r.json()["id"]

        pub = requests.get(f"{API}/settings/fab-buttons", params={"role": "customer"}, timeout=10).json()
        assert "TEST_inactive" not in [b["label"] for b in pub]
        requests.delete(f"{API}/admin/fab-buttons/{bid}", headers=admin_headers, timeout=10)


# =================== ADMIN AUTH ===================

class TestAdminAuth:
    def test_admin_list_requires_auth(self):
        r = requests.get(f"{API}/admin/fab-buttons", timeout=10)
        assert r.status_code in (401, 403), r.text

    def test_admin_create_requires_auth(self):
        r = requests.post(f"{API}/admin/fab-buttons",
                          json={"role": "customer", "label": "x"}, timeout=10)
        assert r.status_code in (401, 403), r.text

    def test_customer_cannot_create(self, customer_token):
        if not customer_token:
            pytest.skip("customer token unavailable")
        r = requests.post(
            f"{API}/admin/fab-buttons",
            headers={"Authorization": f"Bearer {customer_token}"},
            json={"role": "customer", "label": "TEST_evil"}, timeout=10,
        )
        assert r.status_code in (401, 403), r.text


# =================== CRUD ===================

class TestCRUD:
    def test_create_and_get(self, admin_headers, clean_slate):
        r = _create(admin_headers, label="TEST_crud_1", title="MyTitle",
                    content_html="<b>x</b>", order=2)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["label"] == "TEST_crud_1"
        assert body["title"] == "MyTitle"
        assert body["content_html"] == "<b>x</b>"
        assert body["order"] == 2
        assert body["is_active"] is True
        assert "id" in body
        assert "_id" not in body

        # GET admin list contains it
        r2 = requests.get(f"{API}/admin/fab-buttons", headers=admin_headers, timeout=10)
        assert r2.status_code == 200
        ids = [b["id"] for b in r2.json()]
        assert body["id"] in ids

    def test_update_persists(self, admin_headers, clean_slate):
        r = _create(admin_headers, label="TEST_upd")
        bid = r.json()["id"]

        r2 = requests.put(
            f"{API}/admin/fab-buttons/{bid}",
            headers=admin_headers,
            json={"title": "Updated", "order": 5, "is_active": False},
            timeout=10,
        )
        assert r2.status_code == 200, r2.text
        upd = r2.json()
        assert upd["title"] == "Updated"
        assert upd["order"] == 5
        assert upd["is_active"] is False

        # Now must not appear in public list
        pub = requests.get(f"{API}/settings/fab-buttons",
                           params={"role": "customer"}, timeout=10).json()
        assert bid not in [b.get("id") for b in pub]

    def test_update_missing_returns_404(self, admin_headers):
        r = requests.put(f"{API}/admin/fab-buttons/nonexistent-id",
                         headers=admin_headers, json={"title": "x"}, timeout=10)
        assert r.status_code == 404, r.text

    def test_delete_works_and_idempotent(self, admin_headers, clean_slate):
        r = _create(admin_headers, label="TEST_del")
        bid = r.json()["id"]

        r2 = requests.delete(f"{API}/admin/fab-buttons/{bid}",
                             headers=admin_headers, timeout=10)
        assert r2.status_code == 200, r2.text
        assert r2.json().get("success") is True

        # second delete -> 404
        r3 = requests.delete(f"{API}/admin/fab-buttons/{bid}",
                             headers=admin_headers, timeout=10)
        assert r3.status_code == 404

    def test_invalid_role_rejected(self, admin_headers):
        r = requests.post(
            f"{API}/admin/fab-buttons",
            headers=admin_headers,
            json={"role": "guest", "label": "TEST_bad"},
            timeout=10,
        )
        assert r.status_code == 400, r.text


# =================== LIMIT ===================

class TestLimit:
    def test_fourth_active_customer_button_rejected(self, admin_headers, isolated_slate):
        ids = []
        for i in range(3):
            r = _create(admin_headers, role="customer", label=f"TEST_lim_{i}")
            assert r.status_code == 200, r.text
            ids.append(r.json()["id"])

        # 4th should fail
        r4 = _create(admin_headers, role="customer", label="TEST_lim_4")
        assert r4.status_code == 400, r4.text
        msg = (r4.json().get("detail") or "").lower()
        assert "лимит" in msg or "limit" in msg or "3" in msg

        # cleanup explicit (clean_slate also cleans on exit)
        for bid in ids:
            requests.delete(f"{API}/admin/fab-buttons/{bid}",
                            headers=admin_headers, timeout=10)

    def test_inactive_extras_allowed(self, admin_headers, isolated_slate):
        """An inactive button should be allowed beyond limit (it's not counted)."""
        ids = []
        for i in range(3):
            r = _create(admin_headers, role="customer", label=f"TEST_inactive_lim_{i}")
            assert r.status_code == 200
            ids.append(r.json()["id"])
        # 4th but is_active=False — should succeed
        r4 = _create(admin_headers, role="customer",
                     label="TEST_inactive_lim_4", is_active=False)
        assert r4.status_code == 200, r4.text
        ids.append(r4.json()["id"])
        for bid in ids:
            requests.delete(f"{API}/admin/fab-buttons/{bid}",
                            headers=admin_headers, timeout=10)

    def test_both_role_counts_against_both_roles(self, admin_headers, isolated_slate):
        # 2 customer + 1 'both' = 3 active for customer; new customer should fail
        ids = []
        for i in range(2):
            r = _create(admin_headers, role="customer", label=f"TEST_mix_c_{i}")
            ids.append(r.json()["id"])
        r3 = _create(admin_headers, role="both", label="TEST_mix_both")
        assert r3.status_code == 200
        ids.append(r3.json()["id"])

        r4 = _create(admin_headers, role="customer", label="TEST_mix_c_extra")
        assert r4.status_code == 400, r4.text

        for bid in ids:
            requests.delete(f"{API}/admin/fab-buttons/{bid}",
                            headers=admin_headers, timeout=10)


# =================== SVG UPLOAD ===================

class TestSvgUpload:
    def test_upload_valid_svg(self, admin_headers):
        files = {"file": ("icon.svg", _svg_bytes(), "image/svg+xml")}
        r = requests.post(f"{API}/admin/fab-buttons/upload-svg",
                          headers=admin_headers, files=files, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        assert "<svg" in (body.get("svg") or "")

    def test_upload_rejects_non_svg(self, admin_headers):
        files = {"file": ("bad.png", b"\x89PNG\r\n\x1a\nrandom", "image/png")}
        r = requests.post(f"{API}/admin/fab-buttons/upload-svg",
                          headers=admin_headers, files=files, timeout=15)
        assert r.status_code == 400, r.text

    def test_upload_rejects_non_svg_text_content(self, admin_headers):
        # XML content type but no <svg tag — should be rejected
        files = {"file": ("note.xml", b"<?xml version='1.0'?><root></root>",
                          "application/xml")}
        r = requests.post(f"{API}/admin/fab-buttons/upload-svg",
                          headers=admin_headers, files=files, timeout=15)
        assert r.status_code == 400, r.text

    def test_upload_requires_admin(self):
        files = {"file": ("icon.svg", _svg_bytes(), "image/svg+xml")}
        r = requests.post(f"{API}/admin/fab-buttons/upload-svg",
                          files=files, timeout=15)
        assert r.status_code in (401, 403), r.text
