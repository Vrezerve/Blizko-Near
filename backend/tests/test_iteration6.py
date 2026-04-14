"""
Iteration 6 Tests - Driver Toggle Ready & Admin Modules/Updates
Tests for:
1. Driver toggle-ready: POST /api/drivers/toggle-ready returns is_online true/false
2. Admin modules CRUD: GET/POST/DELETE /api/admin/modules
3. Admin module toggle: POST /api/admin/modules/{id}/toggle
4. Admin updates: POST /api/admin/update/upload, GET /api/admin/updates
"""

import pytest
import requests
import os
import io
import zipfile

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://order-sync-platform-1.preview.emergentagent.com')

class TestDriverToggleReady:
    """Driver toggle-ready endpoint tests"""
    
    @pytest.fixture
    def driver_token(self):
        """Get driver token via auth flow"""
        # Send code
        requests.post(f"{BASE_URL}/api/auth/send-code", json={
            "phone": "+79007654321",
            "role": "driver",
            "device_id": "test-device-iteration6"
        })
        
        # Verify with test code 1234
        response = requests.post(f"{BASE_URL}/api/auth/verify-code", json={
            "phone": "+79007654321",
            "code": "1234",
            "role": "driver",
            "device_id": "test-device-iteration6"
        })
        
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Driver auth failed")
    
    def test_toggle_ready_returns_is_online(self, driver_token):
        """POST /api/drivers/toggle-ready returns is_online status"""
        response = requests.post(
            f"{BASE_URL}/api/drivers/toggle-ready",
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "is_online" in data
        assert isinstance(data["is_online"], bool)
        print(f"Toggle result: is_online = {data['is_online']}")
    
    def test_toggle_ready_toggles_status(self, driver_token):
        """Toggle-ready actually toggles the online status"""
        # First toggle
        response1 = requests.post(
            f"{BASE_URL}/api/drivers/toggle-ready",
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        status1 = response1.json()["is_online"]
        
        # Second toggle
        response2 = requests.post(
            f"{BASE_URL}/api/drivers/toggle-ready",
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        status2 = response2.json()["is_online"]
        
        # Status should be opposite
        assert status1 != status2
        print(f"First toggle: {status1}, Second toggle: {status2}")
    
    def test_toggle_ready_requires_auth(self):
        """Toggle-ready requires authentication"""
        response = requests.post(f"{BASE_URL}/api/drivers/toggle-ready")
        assert response.status_code == 401
    
    def test_toggle_ready_requires_driver_role(self):
        """Toggle-ready requires driver role (403 for customers)"""
        # Get customer token
        requests.post(f"{BASE_URL}/api/auth/send-code", json={
            "phone": "+79001234567",
            "role": "customer",
            "device_id": "test-device-customer-iter6"
        })
        
        response = requests.post(f"{BASE_URL}/api/auth/verify-code", json={
            "phone": "+79001234567",
            "code": "1234",
            "role": "customer",
            "device_id": "test-device-customer-iter6"
        })
        
        if response.status_code == 200:
            customer_token = response.json().get("token")
            
            toggle_response = requests.post(
                f"{BASE_URL}/api/drivers/toggle-ready",
                headers={"Authorization": f"Bearer {customer_token}"}
            )
            assert toggle_response.status_code == 403


class TestAdminModules:
    """Admin modules CRUD tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": "admin@taxi.local",
            "password": "admin123"
        })
        
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin login failed")
    
    def test_get_modules_returns_array(self, admin_token):
        """GET /api/admin/modules returns array of modules"""
        response = requests.get(
            f"{BASE_URL}/api/admin/modules",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} modules")
    
    def test_create_module(self, admin_token):
        """POST /api/admin/modules creates a module"""
        response = requests.post(
            f"{BASE_URL}/api/admin/modules",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "name": "TestModule_Iter6",
                "description": "Test module for iteration 6",
                "version": "1.0"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "module" in data
        assert data["module"]["name"] == "TestModule_Iter6"
        assert data["module"]["enabled"] == True
        print(f"Created module: {data['module']['id']}")
        
        # Cleanup - delete the module
        module_id = data["module"]["id"]
        requests.delete(
            f"{BASE_URL}/api/admin/modules/{module_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
    
    def test_toggle_module(self, admin_token):
        """POST /api/admin/modules/{id}/toggle toggles module enabled state"""
        # First create a module
        create_response = requests.post(
            f"{BASE_URL}/api/admin/modules",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"name": "ToggleTestModule", "description": "Test", "version": "1.0"}
        )
        module_id = create_response.json()["module"]["id"]
        initial_enabled = create_response.json()["module"]["enabled"]
        
        # Toggle it
        toggle_response = requests.post(
            f"{BASE_URL}/api/admin/modules/{module_id}/toggle",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert toggle_response.status_code == 200
        data = toggle_response.json()
        assert data.get("success") == True
        assert data["enabled"] != initial_enabled
        print(f"Toggled module: enabled = {data['enabled']}")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/admin/modules/{module_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
    
    def test_delete_module(self, admin_token):
        """DELETE /api/admin/modules/{id} removes a module"""
        # First create a module
        create_response = requests.post(
            f"{BASE_URL}/api/admin/modules",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"name": "DeleteTestModule", "description": "Test", "version": "1.0"}
        )
        module_id = create_response.json()["module"]["id"]
        
        # Delete it
        delete_response = requests.delete(
            f"{BASE_URL}/api/admin/modules/{module_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert delete_response.status_code == 200
        assert delete_response.json().get("success") == True
        print(f"Deleted module: {module_id}")
        
        # Verify it's gone
        modules = requests.get(
            f"{BASE_URL}/api/admin/modules",
            headers={"Authorization": f"Bearer {admin_token}"}
        ).json()
        
        module_ids = [m["id"] for m in modules]
        assert module_id not in module_ids
    
    def test_modules_requires_admin(self):
        """Modules endpoints require admin authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/modules")
        assert response.status_code == 401


class TestAdminUpdates:
    """Admin updates endpoint tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": "admin@taxi.local",
            "password": "admin123"
        })
        
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin login failed")
    
    def test_get_updates_returns_array(self, admin_token):
        """GET /api/admin/updates returns update history"""
        response = requests.get(
            f"{BASE_URL}/api/admin/updates",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} updates in history")
    
    def test_upload_update_accepts_zip(self, admin_token):
        """POST /api/admin/update/upload accepts ZIP file"""
        # Create a test ZIP file in memory
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("test_file.txt", "Test content for iteration 6")
        zip_buffer.seek(0)
        
        response = requests.post(
            f"{BASE_URL}/api/admin/update/upload",
            headers={"Authorization": f"Bearer {admin_token}"},
            files={"file": ("test_update_iter6.zip", zip_buffer, "application/zip")}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "files_count" in data
        print(f"Upload result: {data.get('message')}, files: {data.get('files_count')}")
    
    def test_upload_rejects_non_zip(self, admin_token):
        """POST /api/admin/update/upload rejects non-ZIP files"""
        response = requests.post(
            f"{BASE_URL}/api/admin/update/upload",
            headers={"Authorization": f"Bearer {admin_token}"},
            files={"file": ("test.txt", b"Not a zip file", "text/plain")}
        )
        
        assert response.status_code == 400
    
    def test_updates_requires_admin(self):
        """Updates endpoints require admin authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/updates")
        assert response.status_code == 401


class TestExistingFlows:
    """Verify existing flows still work"""
    
    def test_customer_auth_with_code_1234(self):
        """Customer auth flow with test code 1234 works"""
        # Send code
        send_response = requests.post(f"{BASE_URL}/api/auth/send-code", json={
            "phone": "+79001234567",
            "role": "customer",
            "device_id": "test-device-existing-flow"
        })
        assert send_response.status_code == 200
        
        # Verify with test code 1234
        verify_response = requests.post(f"{BASE_URL}/api/auth/verify-code", json={
            "phone": "+79001234567",
            "code": "1234",
            "role": "customer",
            "device_id": "test-device-existing-flow"
        })
        
        assert verify_response.status_code == 200
        data = verify_response.json()
        assert "token" in data
        assert "user" in data
        print(f"Customer auth successful: {data['user']['phone']}")
    
    def test_admin_login(self):
        """Admin login with admin@taxi.local / admin123 works"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": "admin@taxi.local",
            "password": "admin123"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "admin"
        print(f"Admin login successful: {data['user']['email']}")
    
    def test_public_settings(self):
        """GET /api/settings/public returns app settings"""
        response = requests.get(f"{BASE_URL}/api/settings/public")
        
        assert response.status_code == 200
        data = response.json()
        assert "app_name" in data
        assert data["app_name"] == "Рядом"
        print(f"Public settings: app_name = {data['app_name']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
