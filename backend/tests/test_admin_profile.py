"""
Tests for admin profile endpoints:
  GET  /api/admin/me
  POST /api/admin/me/credentials
Also validates collision, validation, non-admin denial and test_credentials.md update.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://order-sync-platform-1.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@taxi.local"
ADMIN_PASSWORD = "admin123"


# ---------- helpers ----------
def admin_login(email, password):
    return requests.post(f"{BASE_URL}/api/admin/login", json={"email": email, "password": password}, timeout=15)


@pytest.fixture(scope="module")
def admin_token():
    r = admin_login(ADMIN_EMAIL, ADMIN_PASSWORD)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def customer_token():
    device_id = "test-device-admin-profile-001"
    requests.post(f"{BASE_URL}/api/auth/send-code",
                  json={"phone": "+79001234567", "role": "customer", "device_id": device_id}, timeout=15)
    r = requests.post(f"{BASE_URL}/api/auth/verify-code",
                      json={"phone": "+79001234567", "code": "1234", "role": "customer",
                            "device_id": device_id}, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Customer OTP login failed: {r.status_code} {r.text}")
    return r.json().get("token")


def H(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ============ GET /api/admin/me ============
class TestAdminMe:
    def test_admin_me_returns_profile_without_password(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/me", headers=H(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"
        assert "password_hash" not in data
        assert "_id" not in data
        assert "id" in data

    def test_admin_me_without_auth_401(self):
        r = requests.get(f"{BASE_URL}/api/admin/me", timeout=15)
        assert r.status_code == 401

    def test_admin_me_with_customer_token_403(self, customer_token):
        r = requests.get(f"{BASE_URL}/api/admin/me", headers=H(customer_token), timeout=15)
        assert r.status_code in (401, 403)


# ============ POST /api/admin/me/credentials - validation ============
class TestAdminCredentialsValidation:
    def test_wrong_current_password(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/admin/me/credentials", headers=H(admin_token),
                          json={"current_password": "WRONG", "new_password": "newpass123"}, timeout=15)
        assert r.status_code == 400
        assert "Текущий пароль неверен" in r.text

    def test_nothing_to_update(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/admin/me/credentials", headers=H(admin_token),
                          json={"current_password": ADMIN_PASSWORD}, timeout=15)
        assert r.status_code == 400
        assert "Нечего обновлять" in r.text

    def test_short_password(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/admin/me/credentials", headers=H(admin_token),
                          json={"current_password": ADMIN_PASSWORD, "new_password": "abc"}, timeout=15)
        assert r.status_code == 400
        assert "минимум 6 символов" in r.text

    def test_invalid_email(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/admin/me/credentials", headers=H(admin_token),
                          json={"current_password": ADMIN_PASSWORD, "new_email": "noatsign"}, timeout=15)
        assert r.status_code == 400
        assert "Некорректный email" in r.text

    def test_non_admin_denied(self, customer_token):
        r = requests.post(f"{BASE_URL}/api/admin/me/credentials", headers=H(customer_token),
                          json={"current_password": "x", "new_password": "newpass123"}, timeout=15)
        assert r.status_code in (401, 403)

    def test_no_auth_denied(self):
        r = requests.post(f"{BASE_URL}/api/admin/me/credentials",
                          json={"current_password": "x"}, timeout=15)
        assert r.status_code == 401


# ============ POST /api/admin/me/credentials - happy paths (with restore) ============
class TestAdminCredentialsUpdateFlow:
    """Critical: each test MUST restore admin@taxi.local/admin123 at the end."""

    def test_change_password_relogin_and_restore(self, admin_token):
        new_pwd = "newpass456"
        # 1. change password
        r = requests.post(f"{BASE_URL}/api/admin/me/credentials", headers=H(admin_token),
                          json={"current_password": ADMIN_PASSWORD, "new_password": new_pwd}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("success") is True

        # 2. OLD password fails
        r_old = admin_login(ADMIN_EMAIL, ADMIN_PASSWORD)
        assert r_old.status_code == 401, f"Old pwd should fail. Got {r_old.status_code}"

        # 3. NEW password works
        r_new = admin_login(ADMIN_EMAIL, new_pwd)
        assert r_new.status_code == 200, r_new.text
        new_token = r_new.json()["token"]

        # 4. test_credentials.md updated
        try:
            with open("/app/memory/test_credentials.md") as f:
                content = f.read()
            assert new_pwd in content, "test_credentials.md not updated with new password"
        except FileNotFoundError:
            pytest.fail("test_credentials.md missing after admin pwd update")

        # 5. RESTORE
        r_restore = requests.post(f"{BASE_URL}/api/admin/me/credentials", headers=H(new_token),
                                  json={"current_password": new_pwd, "new_password": ADMIN_PASSWORD}, timeout=15)
        assert r_restore.status_code == 200, f"RESTORE FAILED: {r_restore.text}"
        # verify restore
        assert admin_login(ADMIN_EMAIL, ADMIN_PASSWORD).status_code == 200, "Admin login broken after restore!"

    def test_change_email_relogin_and_restore(self, admin_token):
        new_email = "admin2@taxi.local"
        r = requests.post(f"{BASE_URL}/api/admin/me/credentials", headers=H(admin_token),
                          json={"current_password": ADMIN_PASSWORD, "new_email": new_email}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("email") == new_email

        # OLD email should NOT work
        assert admin_login(ADMIN_EMAIL, ADMIN_PASSWORD).status_code == 401
        # NEW email works
        r_new = admin_login(new_email, ADMIN_PASSWORD)
        assert r_new.status_code == 200, r_new.text
        new_token = r_new.json()["token"]

        # RESTORE
        r_restore = requests.post(f"{BASE_URL}/api/admin/me/credentials", headers=H(new_token),
                                  json={"current_password": ADMIN_PASSWORD, "new_email": ADMIN_EMAIL}, timeout=15)
        assert r_restore.status_code == 200, f"RESTORE FAILED: {r_restore.text}"
        assert admin_login(ADMIN_EMAIL, ADMIN_PASSWORD).status_code == 200, "Admin email not restored!"

    def test_email_collision(self, admin_token):
        device_id = "test-device-admin-profile-002"
        requests.post(f"{BASE_URL}/api/auth/send-code",
                      json={"phone": "+79001234567", "role": "customer", "device_id": device_id}, timeout=15)
        requests.post(f"{BASE_URL}/api/auth/verify-code",
                      json={"phone": "+79001234567", "code": "1234", "role": "customer",
                            "device_id": device_id}, timeout=15)
        # Find a non-admin user with email
        users_r = requests.get(f"{BASE_URL}/api/admin/users", headers=H(admin_token), timeout=15)
        assert users_r.status_code == 200
        other_email = None
        for u in users_r.json():
            if u.get("role") != "admin" and u.get("email"):
                other_email = u["email"]
                break
        if not other_email:
            pytest.skip("No other user with email to test collision")
        r = requests.post(f"{BASE_URL}/api/admin/me/credentials", headers=H(admin_token),
                          json={"current_password": ADMIN_PASSWORD, "new_email": other_email}, timeout=15)
        assert r.status_code == 400
        assert "уже используется" in r.text
