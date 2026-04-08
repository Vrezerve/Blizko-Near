"""
PIN Authentication Tests for Taxi WebToApp
Tests PIN setup, login, reset, and check endpoints
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://order-sync-platform-1.preview.emergentagent.com').rstrip('/')

# Test data
TEST_PHONE_WITH_PIN = "+79009999999"
TEST_PIN = "1234"
TEST_ROLE = "customer"
TEST_DEVICE_ID = "test-device-pin-pytest"

ADMIN_EMAIL = "admin@taxi.local"
ADMIN_PASSWORD = "admin123"


class TestPinCheckEndpoint:
    """Tests for GET /api/auth/check-pin/{phone}/{role}"""
    
    def test_check_pin_existing_user_with_pin(self):
        """User with PIN should return has_pin=True"""
        response = requests.get(f"{BASE_URL}/api/auth/check-pin/{TEST_PHONE_WITH_PIN}/{TEST_ROLE}")
        assert response.status_code == 200
        data = response.json()
        assert data["exists"] == True
        assert data["has_pin"] == True
        assert "pin_locked" in data
        print(f"✓ check-pin for existing user: {data}")
    
    def test_check_pin_nonexistent_user(self):
        """Non-existent user should return exists=False"""
        response = requests.get(f"{BASE_URL}/api/auth/check-pin/+79999999999/customer")
        assert response.status_code == 200
        data = response.json()
        assert data["exists"] == False
        assert data["has_pin"] == False
        print(f"✓ check-pin for non-existent user: {data}")


class TestPinLoginEndpoint:
    """Tests for POST /api/auth/login-pin"""
    
    def test_login_pin_correct(self):
        """Login with correct PIN should return token and user"""
        response = requests.post(f"{BASE_URL}/api/auth/login-pin", json={
            "phone": TEST_PHONE_WITH_PIN,
            "pin": TEST_PIN,
            "role": TEST_ROLE,
            "device_id": TEST_DEVICE_ID
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["phone"] == TEST_PHONE_WITH_PIN
        assert data["user"]["role"] == TEST_ROLE
        print(f"✓ login-pin with correct PIN: token received, user={data['user']['phone']}")
    
    def test_login_pin_wrong(self):
        """Login with wrong PIN should return WRONG_PIN error"""
        response = requests.post(f"{BASE_URL}/api/auth/login-pin", json={
            "phone": TEST_PHONE_WITH_PIN,
            "pin": "9999",
            "role": TEST_ROLE,
            "device_id": TEST_DEVICE_ID
        })
        assert response.status_code == 401
        data = response.json()
        assert "WRONG_PIN" in data["detail"]
        # Extract remaining attempts
        attempts_left = int(data["detail"].split(":")[1])
        assert attempts_left >= 0 and attempts_left <= 5
        print(f"✓ login-pin with wrong PIN: {data['detail']}")
    
    def test_login_pin_user_not_found(self):
        """Login with non-existent user should return 404"""
        response = requests.post(f"{BASE_URL}/api/auth/login-pin", json={
            "phone": "+79999999999",
            "pin": "1234",
            "role": "customer",
            "device_id": TEST_DEVICE_ID
        })
        assert response.status_code == 404
        print(f"✓ login-pin for non-existent user: 404")


class TestPinResetEndpoint:
    """Tests for PIN reset flow"""
    
    def test_reset_pin_request(self):
        """Reset PIN request should send code"""
        response = requests.post(f"{BASE_URL}/api/auth/reset-pin-request", json={
            "phone": TEST_PHONE_WITH_PIN,
            "role": TEST_ROLE,
            "device_id": TEST_DEVICE_ID
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "Code sent" in data["message"]
        print(f"✓ reset-pin-request: {data}")
    
    def test_reset_pin_request_user_not_found(self):
        """Reset PIN for non-existent user should return 404"""
        response = requests.post(f"{BASE_URL}/api/auth/reset-pin-request", json={
            "phone": "+79999999999",
            "role": "customer",
            "device_id": TEST_DEVICE_ID
        })
        assert response.status_code == 404
        print(f"✓ reset-pin-request for non-existent user: 404")
    
    def test_reset_pin_verify_invalid_code(self):
        """Reset PIN verify with invalid code should fail"""
        response = requests.post(f"{BASE_URL}/api/auth/reset-pin-verify", json={
            "phone": TEST_PHONE_WITH_PIN,
            "code": "0000",
            "role": TEST_ROLE,
            "device_id": TEST_DEVICE_ID,
            "new_pin": "5678"
        })
        assert response.status_code == 400
        data = response.json()
        assert "Invalid code" in data["detail"]
        print(f"✓ reset-pin-verify with invalid code: {data}")


class TestSetPinEndpoint:
    """Tests for POST /api/auth/set-pin (requires auth)"""
    
    def test_set_pin_requires_auth(self):
        """Set PIN without auth should return 401"""
        response = requests.post(f"{BASE_URL}/api/auth/set-pin", json={
            "pin": "1234"
        })
        assert response.status_code == 401
        print(f"✓ set-pin without auth: 401")
    
    def test_set_pin_with_auth(self):
        """Set PIN with valid auth should succeed"""
        # First login to get token
        login_response = requests.post(f"{BASE_URL}/api/auth/login-pin", json={
            "phone": TEST_PHONE_WITH_PIN,
            "pin": TEST_PIN,
            "role": TEST_ROLE,
            "device_id": TEST_DEVICE_ID
        })
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        # Set PIN with auth
        response = requests.post(
            f"{BASE_URL}/api/auth/set-pin",
            json={"pin": TEST_PIN},  # Keep same PIN
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print(f"✓ set-pin with auth: {data}")
    
    def test_set_pin_invalid_format(self):
        """Set PIN with invalid format should fail"""
        # First login to get token
        login_response = requests.post(f"{BASE_URL}/api/auth/login-pin", json={
            "phone": TEST_PHONE_WITH_PIN,
            "pin": TEST_PIN,
            "role": TEST_ROLE,
            "device_id": TEST_DEVICE_ID
        })
        token = login_response.json()["token"]
        
        # Try to set invalid PIN (not 4 digits)
        response = requests.post(
            f"{BASE_URL}/api/auth/set-pin",
            json={"pin": "123"},  # Only 3 digits
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 400
        print(f"✓ set-pin with invalid format: 400")


class TestAdminBlockedDevices:
    """Tests for admin blocked devices endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_get_blocked_devices(self, admin_token):
        """Admin should be able to get blocked devices list"""
        response = requests.get(
            f"{BASE_URL}/api/admin/blocked-devices",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ get blocked devices: {len(data)} devices")
    
    def test_get_blocked_devices_requires_admin(self):
        """Non-admin should not access blocked devices"""
        # Login as customer
        login_response = requests.post(f"{BASE_URL}/api/auth/login-pin", json={
            "phone": TEST_PHONE_WITH_PIN,
            "pin": TEST_PIN,
            "role": TEST_ROLE,
            "device_id": TEST_DEVICE_ID
        })
        token = login_response.json()["token"]
        
        response = requests.get(
            f"{BASE_URL}/api/admin/blocked-devices",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 403
        print(f"✓ blocked devices requires admin: 403")


class TestAdminPanel:
    """Tests for admin panel endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_admin_login(self):
        """Admin login should work with correct credentials"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "admin"
        print(f"✓ admin login: {data['user']['email']}")
    
    def test_admin_stats(self, admin_token):
        """Admin should be able to get stats"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "customers" in data
        assert "drivers" in data
        assert "orders" in data
        assert "blocked_devices" in data
        print(f"✓ admin stats: customers={data['customers']}, drivers={data['drivers']['total']}")
    
    def test_admin_users_list(self, admin_token):
        """Admin should be able to list users"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ admin users list: {len(data)} users")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
