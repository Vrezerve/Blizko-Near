"""
Test cases for bug fixes in iteration 6:
1. Icon file upload (replaces URL input)
2. Driver go-online button enabled (removed balance check)
3. Input icon spacing (frontend only - tested via Playwright)
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestIconUpload:
    """Test icon file upload functionality"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": "admin@taxi.local",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["token"]
    
    def test_upload_icon_success(self, admin_token):
        """Test POST /api/settings/upload-icon with PNG file returns success and URL"""
        # Create a minimal valid PNG file
        png_header = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        
        files = {'file': ('test_icon.png', io.BytesIO(png_header), 'image/png')}
        response = requests.post(
            f"{BASE_URL}/api/settings/upload-icon",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files
        )
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "url" in data
        assert data["url"].startswith("/api/uploads/")
        assert data["url"].endswith(".png")
    
    def test_uploaded_file_is_servable(self, admin_token):
        """Test uploaded file is servable at /api/uploads/{filename}"""
        # First upload a file
        png_header = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        
        files = {'file': ('test_icon2.png', io.BytesIO(png_header), 'image/png')}
        upload_response = requests.post(
            f"{BASE_URL}/api/settings/upload-icon",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files
        )
        
        assert upload_response.status_code == 200
        url = upload_response.json()["url"]
        
        # Now try to fetch the uploaded file
        file_response = requests.get(f"{BASE_URL}{url}")
        assert file_response.status_code == 200, f"File not servable at {url}"
    
    def test_upload_icon_requires_auth(self):
        """Test upload endpoint requires authentication"""
        png_header = b'\x89PNG\r\n\x1a\n'
        files = {'file': ('test.png', io.BytesIO(png_header), 'image/png')}
        
        response = requests.post(f"{BASE_URL}/api/settings/upload-icon", files=files)
        assert response.status_code == 401
    
    def test_upload_icon_rejects_invalid_format(self, admin_token):
        """Test upload rejects non-image files"""
        files = {'file': ('test.txt', io.BytesIO(b'not an image'), 'text/plain')}
        
        response = requests.post(
            f"{BASE_URL}/api/settings/upload-icon",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files
        )
        
        assert response.status_code == 400
        assert "Допустимые форматы" in response.json().get("detail", "")


class TestDriverToggleReady:
    """Test driver toggle-ready functionality (go online button)"""
    
    @pytest.fixture
    def driver_token(self):
        """Get driver authentication token using test code 1234"""
        response = requests.post(f"{BASE_URL}/api/auth/verify-code", json={
            "phone": "+79999999999",
            "code": "1234",
            "role": "driver",
            "device_id": "test-device-toggle-ready"
        })
        assert response.status_code == 200, f"Driver login failed: {response.text}"
        return response.json()["token"]
    
    def test_toggle_ready_works(self, driver_token):
        """Test POST /api/drivers/toggle-ready returns is_online"""
        response = requests.post(
            f"{BASE_URL}/api/drivers/toggle-ready",
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        
        assert response.status_code == 200, f"Toggle ready failed: {response.text}"
        data = response.json()
        assert "is_online" in data
        assert isinstance(data["is_online"], bool)
    
    def test_toggle_ready_toggles_status(self, driver_token):
        """Test toggle-ready actually toggles the online status"""
        # First call
        response1 = requests.post(
            f"{BASE_URL}/api/drivers/toggle-ready",
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert response1.status_code == 200
        status1 = response1.json()["is_online"]
        
        # Second call should toggle
        response2 = requests.post(
            f"{BASE_URL}/api/drivers/toggle-ready",
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert response2.status_code == 200
        status2 = response2.json()["is_online"]
        
        assert status1 != status2, "Toggle should change the status"
    
    def test_toggle_ready_requires_auth(self):
        """Test toggle-ready requires authentication"""
        response = requests.post(f"{BASE_URL}/api/drivers/toggle-ready")
        assert response.status_code == 401
    
    def test_toggle_ready_requires_driver_role(self):
        """Test toggle-ready requires driver role (not customer)"""
        # Login as customer
        customer_response = requests.post(f"{BASE_URL}/api/auth/verify-code", json={
            "phone": "+79009999999",
            "code": "1234",
            "role": "customer",
            "device_id": "test-device-customer"
        })
        
        if customer_response.status_code == 200:
            customer_token = customer_response.json()["token"]
            
            response = requests.post(
                f"{BASE_URL}/api/drivers/toggle-ready",
                headers={"Authorization": f"Bearer {customer_token}"}
            )
            assert response.status_code == 403


class TestPublicSettings:
    """Test public settings API returns app branding"""
    
    def test_public_settings_returns_app_name(self):
        """Test GET /api/settings/public returns app_name"""
        response = requests.get(f"{BASE_URL}/api/settings/public")
        
        assert response.status_code == 200
        data = response.json()
        assert "app_name" in data
        assert isinstance(data["app_name"], str)
    
    def test_public_settings_returns_app_icon_url(self):
        """Test GET /api/settings/public returns app_icon_url"""
        response = requests.get(f"{BASE_URL}/api/settings/public")
        
        assert response.status_code == 200
        data = response.json()
        assert "app_icon_url" in data


class TestAdminSettings:
    """Test admin can change app settings"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": "admin@taxi.local",
            "password": "admin123"
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_admin_can_change_app_name(self, admin_token):
        """Test admin can update app_name via POST /api/settings/"""
        # Get current settings
        get_response = requests.get(
            f"{BASE_URL}/api/settings/",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert get_response.status_code == 200
        
        # Update app_name
        new_name = "Рядом Тест"
        update_response = requests.post(
            f"{BASE_URL}/api/settings/",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"app_name": new_name}
        )
        assert update_response.status_code == 200
        assert update_response.json().get("success") == True
        
        # Verify change in public settings
        public_response = requests.get(f"{BASE_URL}/api/settings/public")
        assert public_response.status_code == 200
        assert public_response.json()["app_name"] == new_name
        
        # Restore original name
        requests.post(
            f"{BASE_URL}/api/settings/",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"app_name": "Рядом"}
        )


class TestAuthFlows:
    """Test authentication flows with test code 1234"""
    
    def test_customer_auth_with_test_code(self):
        """Test customer auth flow with test code 1234"""
        # Send code
        send_response = requests.post(f"{BASE_URL}/api/auth/send-code", json={
            "phone": "+79001234567",
            "role": "customer",
            "device_id": "test-device-customer-auth"
        })
        assert send_response.status_code == 200
        
        # Verify with test code 1234
        verify_response = requests.post(f"{BASE_URL}/api/auth/verify-code", json={
            "phone": "+79001234567",
            "code": "1234",
            "role": "customer",
            "device_id": "test-device-customer-auth"
        })
        assert verify_response.status_code == 200
        data = verify_response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "customer"
    
    def test_driver_auth_with_test_code(self):
        """Test driver auth flow with test code 1234 (existing activated driver)"""
        # Verify with test code 1234 for existing driver
        verify_response = requests.post(f"{BASE_URL}/api/auth/verify-code", json={
            "phone": "+79999999999",
            "code": "1234",
            "role": "driver",
            "device_id": "test-device-driver-auth"
        })
        assert verify_response.status_code == 200
        data = verify_response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "driver"
        assert data["user"]["is_activated"] == True
    
    def test_admin_login(self):
        """Test admin login with admin@taxi.local / admin123"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": "admin@taxi.local",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "admin"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
