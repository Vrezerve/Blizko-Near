"""Iteration 23 regression: /api/settings/public still includes required keys after UI-only changes."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://order-sync-platform-1.preview.emergentagent.com').rstrip('/')

REQUIRED_KEYS = [
    "test_mode",
    "call_verify_enabled",
    "auth_slides",
    "auth_slides_autoplay",
    "auth_slides_interval",
    "maintenance_mode",
    "app_name",
    "pwa_enabled",
]


@pytest.fixture(scope="module")
def public_settings():
    r = requests.get(f"{BASE_URL}/api/settings/public", timeout=10)
    assert r.status_code == 200, r.text
    return r.json()


def test_public_settings_status(public_settings):
    assert isinstance(public_settings, dict)


@pytest.mark.parametrize("key", REQUIRED_KEYS)
def test_public_settings_has_required_key(public_settings, key):
    assert key in public_settings, f"missing key {key}"


def test_test_mode_is_false_by_default(public_settings):
    # Iteration 23 expects test_mode=false in production
    assert public_settings["test_mode"] is False


def test_call_verify_enabled_true(public_settings):
    assert public_settings["call_verify_enabled"] is True


def test_auth_slides_present(public_settings):
    slides = public_settings.get("auth_slides") or []
    assert isinstance(slides, list)
    assert len(slides) >= 1, "expected pre-existing seeded auth_slides"
    for s in slides:
        assert "id" in s and "url" in s


class TestAdminToggleTestMode:
    """Toggle test_mode via admin API, verify public/public_settings reflect + restore."""

    @classmethod
    def setup_class(cls):
        # login as admin
        r = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"email": "admin@taxi.local", "password": "admin123"},
            timeout=10,
        )
        assert r.status_code == 200, r.text
        cls.token = r.json().get("token") or r.json().get("access_token")
        assert cls.token, r.json()
        cls.headers = {"Authorization": f"Bearer {cls.token}"}

    def test_toggle_test_mode_true_and_restore(self):
        # Read current
        r0 = requests.get(f"{BASE_URL}/api/settings/", headers=self.headers, timeout=10)
        assert r0.status_code == 200, r0.text
        original = r0.json().get("test_mode", False)

        try:
            # Set true (endpoint is POST /api/settings/ per server.py L2484)
            r1 = requests.post(
                f"{BASE_URL}/api/settings/",
                headers=self.headers,
                json={"test_mode": True},
                timeout=10,
            )
            assert r1.status_code in (200, 204), r1.text

            # Verify via public endpoint
            r2 = requests.get(f"{BASE_URL}/api/settings/public", timeout=10)
            assert r2.status_code == 200
            assert r2.json().get("test_mode") is True
        finally:
            # Restore
            requests.post(
                f"{BASE_URL}/api/settings/",
                headers=self.headers,
                json={"test_mode": original},
                timeout=10,
            )

        # Confirm restored
        r3 = requests.get(f"{BASE_URL}/api/settings/public", timeout=10)
        assert r3.json().get("test_mode") == original
