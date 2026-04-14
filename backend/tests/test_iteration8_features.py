"""
Test Iteration 8 Features:
1. Test mode toggle in settings
2. OTP code 1234 behavior based on test_mode
3. Module CRUD (create, toggle, delete)
4. Module ZIP upload
5. Public settings endpoint returns test_mode
"""
import pytest
import requests
import os
import io
import zipfile

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPublicSettings:
    """Test public settings endpoint returns test_mode"""
    
    def test_public_settings_returns_test_mode(self):
        """GET /api/settings/public should return test_mode field"""
        response = requests.get(f"{BASE_URL}/api/settings/public")
        assert response.status_code == 200
        data = response.json()
        assert "test_mode" in data, "test_mode field missing from public settings"
        assert isinstance(data["test_mode"], bool), "test_mode should be boolean"
        print(f"✓ Public settings returns test_mode: {data['test_mode']}")


class TestAdminAuth:
    """Admin authentication tests"""
    
    def test_admin_login_success(self):
        """POST /api/admin/login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": "admin@taxi.local",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == "admin@taxi.local"
        print("✓ Admin login successful")
        return data["token"]


class TestTestModeToggle:
    """Test mode toggle functionality"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": "admin@taxi.local",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_get_settings_with_test_mode(self, admin_token):
        """GET /api/settings/ should return test_mode"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/settings/", headers=headers)
        assert response.status_code == 200
        data = response.json()
        # test_mode may or may not be present, but if present should be boolean
        if "test_mode" in data:
            assert isinstance(data["test_mode"], bool)
        print(f"✓ Settings retrieved, test_mode: {data.get('test_mode', 'not set')}")
    
    def test_update_test_mode_to_false(self, admin_token):
        """POST /api/settings/ with test_mode=false"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(f"{BASE_URL}/api/settings/", 
            headers=headers,
            json={"test_mode": False}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print("✓ test_mode set to false")
        
        # Verify via public settings
        pub_response = requests.get(f"{BASE_URL}/api/settings/public")
        assert pub_response.status_code == 200
        pub_data = pub_response.json()
        assert pub_data["test_mode"] == False, "Public settings should show test_mode=false"
        print("✓ Public settings confirms test_mode=false")
    
    def test_otp_1234_rejected_when_test_mode_false(self, admin_token):
        """OTP code 1234 should be rejected when test_mode=false"""
        # First ensure test_mode is false
        headers = {"Authorization": f"Bearer {admin_token}"}
        requests.post(f"{BASE_URL}/api/settings/", 
            headers=headers,
            json={"test_mode": False}
        )
        
        # Try to verify with code 1234
        response = requests.post(f"{BASE_URL}/api/auth/verify-code", json={
            "phone": "+79001234567",
            "code": "1234",
            "role": "customer",
            "device_id": "test-device-otp-reject"
        })
        # Should fail with 400 Invalid code
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "Invalid code" in data.get("detail", ""), f"Expected 'Invalid code', got: {data}"
        print("✓ OTP 1234 correctly rejected when test_mode=false")
    
    def test_update_test_mode_to_true(self, admin_token):
        """POST /api/settings/ with test_mode=true"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(f"{BASE_URL}/api/settings/", 
            headers=headers,
            json={"test_mode": True}
        )
        assert response.status_code == 200
        print("✓ test_mode set to true")
        
        # Verify via public settings
        pub_response = requests.get(f"{BASE_URL}/api/settings/public")
        pub_data = pub_response.json()
        assert pub_data["test_mode"] == True, "Public settings should show test_mode=true"
        print("✓ Public settings confirms test_mode=true")
    
    def test_otp_1234_accepted_when_test_mode_true(self, admin_token):
        """OTP code 1234 should be accepted when test_mode=true"""
        # First ensure test_mode is true
        headers = {"Authorization": f"Bearer {admin_token}"}
        requests.post(f"{BASE_URL}/api/settings/", 
            headers=headers,
            json={"test_mode": True}
        )
        
        # Try to verify with code 1234 - should work for new customer
        response = requests.post(f"{BASE_URL}/api/auth/verify-code", json={
            "phone": "+79009999888",  # Use a new phone to avoid existing user issues
            "code": "1234",
            "role": "customer",
            "device_id": "test-device-otp-accept-new"
        })
        # Should succeed (200) or fail for other reasons (not "Invalid code")
        if response.status_code == 200:
            print("✓ OTP 1234 accepted when test_mode=true (new customer created)")
        elif response.status_code == 403:
            # Device blocked is acceptable
            print("✓ OTP 1234 would be accepted but device blocked (expected in test env)")
        else:
            data = response.json()
            # If it fails, it should NOT be "Invalid code"
            assert "Invalid code" not in data.get("detail", ""), \
                f"OTP 1234 should be accepted when test_mode=true, got: {data}"
            print(f"✓ OTP 1234 processed (status: {response.status_code}, reason: {data.get('detail', 'unknown')})")


class TestModuleCRUD:
    """Module CRUD operations"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": "admin@taxi.local",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_create_module(self, admin_token):
        """POST /api/admin/modules creates a new module"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(f"{BASE_URL}/api/admin/modules", 
            headers=headers,
            json={
                "name": "TEST_Module_Iteration8",
                "description": "Test module for iteration 8",
                "version": "1.0.0"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "module" in data
        assert data["module"]["name"] == "TEST_Module_Iteration8"
        assert data["module"]["enabled"] == True
        print(f"✓ Module created with id: {data['module']['id']}")
        return data["module"]["id"]
    
    def test_get_modules_list(self, admin_token):
        """GET /api/admin/modules returns list of modules"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/modules", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Retrieved {len(data)} modules")
    
    def test_toggle_module(self, admin_token):
        """POST /api/admin/modules/{id}/toggle toggles module state"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First create a module
        create_resp = requests.post(f"{BASE_URL}/api/admin/modules", 
            headers=headers,
            json={"name": "TEST_Toggle_Module", "description": "For toggle test"}
        )
        module_id = create_resp.json()["module"]["id"]
        
        # Toggle it (should disable since default is enabled)
        toggle_resp = requests.post(f"{BASE_URL}/api/admin/modules/{module_id}/toggle", 
            headers=headers
        )
        assert toggle_resp.status_code == 200
        data = toggle_resp.json()
        assert data.get("success") == True
        assert data.get("enabled") == False  # Was True, now False
        print(f"✓ Module toggled to enabled={data['enabled']}")
        
        # Toggle again (should enable)
        toggle_resp2 = requests.post(f"{BASE_URL}/api/admin/modules/{module_id}/toggle", 
            headers=headers
        )
        assert toggle_resp2.json()["enabled"] == True
        print("✓ Module toggled back to enabled=True")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/modules/{module_id}", headers=headers)
    
    def test_delete_module(self, admin_token):
        """DELETE /api/admin/modules/{id} removes module from DB"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create a module to delete
        create_resp = requests.post(f"{BASE_URL}/api/admin/modules", 
            headers=headers,
            json={"name": "TEST_Delete_Module", "description": "For delete test"}
        )
        module_id = create_resp.json()["module"]["id"]
        
        # Delete it
        delete_resp = requests.delete(f"{BASE_URL}/api/admin/modules/{module_id}", 
            headers=headers
        )
        assert delete_resp.status_code == 200
        data = delete_resp.json()
        assert data.get("success") == True
        print(f"✓ Module {module_id} deleted")
        
        # Verify it's gone - should return 404
        get_resp = requests.get(f"{BASE_URL}/api/admin/modules", headers=headers)
        modules = get_resp.json()
        module_ids = [m["id"] for m in modules]
        assert module_id not in module_ids, "Deleted module should not be in list"
        print("✓ Deleted module confirmed removed from DB")


class TestModuleZipUpload:
    """Module ZIP upload functionality"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": "admin@taxi.local",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_upload_zip_to_module(self, admin_token):
        """POST /api/admin/modules/{id}/upload accepts ZIP file"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create a module first
        create_resp = requests.post(f"{BASE_URL}/api/admin/modules", 
            headers=headers,
            json={"name": "TEST_Upload_Module", "description": "For upload test"}
        )
        module_id = create_resp.json()["module"]["id"]
        
        # Create a test ZIP file in memory
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("readme.txt", "Test module content")
            zf.writestr("config.json", '{"version": "1.0"}')
        zip_buffer.seek(0)
        
        # Upload the ZIP
        files = {"file": ("test_module.zip", zip_buffer, "application/zip")}
        upload_resp = requests.post(
            f"{BASE_URL}/api/admin/modules/{module_id}/upload",
            headers=headers,
            files=files
        )
        assert upload_resp.status_code == 200
        data = upload_resp.json()
        assert data.get("success") == True
        assert "archive_path" in data
        assert data["archive_path"].endswith(".zip")
        print(f"✓ ZIP uploaded, path: {data['archive_path']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/modules/{module_id}", headers=headers)
        print("✓ Module with archive deleted")
    
    def test_upload_non_zip_rejected(self, admin_token):
        """POST /api/admin/modules/{id}/upload rejects non-ZIP files"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create a module first
        create_resp = requests.post(f"{BASE_URL}/api/admin/modules", 
            headers=headers,
            json={"name": "TEST_NonZip_Module", "description": "For non-zip test"}
        )
        module_id = create_resp.json()["module"]["id"]
        
        # Try to upload a non-ZIP file
        files = {"file": ("test.txt", io.BytesIO(b"not a zip"), "text/plain")}
        upload_resp = requests.post(
            f"{BASE_URL}/api/admin/modules/{module_id}/upload",
            headers=headers,
            files=files
        )
        assert upload_resp.status_code == 400
        data = upload_resp.json()
        assert "ZIP" in data.get("detail", "")
        print("✓ Non-ZIP file correctly rejected")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/modules/{module_id}", headers=headers)


class TestCleanup:
    """Cleanup test data and restore test_mode"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": "admin@taxi.local",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_cleanup_test_modules(self, admin_token):
        """Remove all TEST_ prefixed modules"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/modules", headers=headers)
        modules = response.json()
        
        deleted = 0
        for module in modules:
            if module["name"].startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/admin/modules/{module['id']}", headers=headers)
                deleted += 1
        
        print(f"✓ Cleaned up {deleted} test modules")
    
    def test_restore_test_mode_true(self, admin_token):
        """Ensure test_mode is restored to true after tests"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(f"{BASE_URL}/api/settings/", 
            headers=headers,
            json={"test_mode": True}
        )
        assert response.status_code == 200
        
        # Verify
        pub_response = requests.get(f"{BASE_URL}/api/settings/public")
        assert pub_response.json()["test_mode"] == True
        print("✓ test_mode restored to true")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
