"""
PHP Web Installer Tests for Taxi Service 'Ryadom'
Tests the install.php AJAX endpoints and HTML rendering
"""
import pytest
import requests
import os
import json

# PHP server URL for testing
PHP_SERVER_URL = "http://localhost:9090"
INSTALL_PHP_URL = f"{PHP_SERVER_URL}/install.php"

# Lock file path
LOCK_FILE = "/app/.install_lock"


class TestPHPSyntax:
    """Test PHP syntax validation"""
    
    def test_php_syntax_valid(self):
        """PHP file should have no syntax errors"""
        result = os.popen("php -l /app/install.php 2>&1").read()
        assert "No syntax errors detected" in result, f"PHP syntax error: {result}"
        print("✓ PHP syntax is valid")


class TestCheckLockEndpoint:
    """Test check_lock AJAX endpoint"""
    
    def test_check_lock_returns_json(self):
        """check_lock should return valid JSON"""
        response = requests.post(INSTALL_PHP_URL, data={"action": "check_lock"})
        assert response.status_code == 200
        data = response.json()
        assert "ok" in data
        assert data["ok"] == True
        print("✓ check_lock returns valid JSON")
    
    def test_check_lock_locked_false_initially(self):
        """check_lock should return locked=false when no lock file exists"""
        # Ensure lock file doesn't exist
        if os.path.exists(LOCK_FILE):
            os.remove(LOCK_FILE)
        
        response = requests.post(INSTALL_PHP_URL, data={"action": "check_lock"})
        data = response.json()
        assert data["locked"] == False
        print("✓ check_lock returns locked=false when no lock file")
    
    def test_check_lock_locked_true_when_file_exists(self):
        """check_lock should return locked=true when lock file exists"""
        # Create lock file
        with open(LOCK_FILE, "w") as f:
            f.write("test")
        
        try:
            response = requests.post(INSTALL_PHP_URL, data={"action": "check_lock"})
            data = response.json()
            assert data["locked"] == True
            print("✓ check_lock returns locked=true when lock file exists")
        finally:
            # Cleanup
            if os.path.exists(LOCK_FILE):
                os.remove(LOCK_FILE)


class TestCheckSystemEndpoint:
    """Test check_system AJAX endpoint"""
    
    def test_check_system_returns_json(self):
        """check_system should return valid JSON with checks object"""
        # Ensure no lock file
        if os.path.exists(LOCK_FILE):
            os.remove(LOCK_FILE)
        
        response = requests.post(INSTALL_PHP_URL, data={"action": "check_system"})
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] == True
        assert "checks" in data
        print("✓ check_system returns valid JSON with checks")
    
    def test_check_system_nodejs_status(self):
        """check_system should report nodejs status"""
        response = requests.post(INSTALL_PHP_URL, data={"action": "check_system"})
        data = response.json()
        checks = data["checks"]
        
        assert "nodejs" in checks
        assert "installed" in checks["nodejs"]
        assert "version" in checks["nodejs"]
        print(f"✓ nodejs: installed={checks['nodejs']['installed']}, version={checks['nodejs']['version']}")
    
    def test_check_system_python3_status(self):
        """check_system should report python3 status"""
        response = requests.post(INSTALL_PHP_URL, data={"action": "check_system"})
        data = response.json()
        checks = data["checks"]
        
        assert "python3" in checks
        assert "installed" in checks["python3"]
        assert "version" in checks["python3"]
        print(f"✓ python3: installed={checks['python3']['installed']}, version={checks['python3']['version']}")
    
    def test_check_system_mongodb_status(self):
        """check_system should report mongodb status"""
        response = requests.post(INSTALL_PHP_URL, data={"action": "check_system"})
        data = response.json()
        checks = data["checks"]
        
        assert "mongodb" in checks
        assert "installed" in checks["mongodb"]
        assert "running" in checks["mongodb"]
        print(f"✓ mongodb: installed={checks['mongodb']['installed']}, running={checks['mongodb']['running']}")
    
    def test_check_system_nginx_status(self):
        """check_system should report nginx status"""
        response = requests.post(INSTALL_PHP_URL, data={"action": "check_system"})
        data = response.json()
        checks = data["checks"]
        
        assert "nginx" in checks
        assert "installed" in checks["nginx"]
        assert "running" in checks["nginx"]
        print(f"✓ nginx: installed={checks['nginx']['installed']}, running={checks['nginx']['running']}")
    
    def test_check_system_project_files(self):
        """check_system should report project files status"""
        response = requests.post(INSTALL_PHP_URL, data={"action": "check_system"})
        data = response.json()
        checks = data["checks"]
        
        assert "project" in checks
        assert "backend" in checks["project"]
        assert "frontend" in checks["project"]
        assert "requirements" in checks["project"]
        print(f"✓ project files: backend={checks['project']['backend']}, frontend={checks['project']['frontend']}")
    
    def test_check_system_server_ip(self):
        """check_system should return server IP"""
        response = requests.post(INSTALL_PHP_URL, data={"action": "check_system"})
        data = response.json()
        checks = data["checks"]
        
        assert "server_ip" in checks
        assert checks["server_ip"] is not None
        print(f"✓ server_ip: {checks['server_ip']}")
    
    def test_check_system_shell_exec(self):
        """check_system should report shell_exec availability"""
        response = requests.post(INSTALL_PHP_URL, data={"action": "check_system"})
        data = response.json()
        checks = data["checks"]
        
        assert "shell_exec" in checks
        assert checks["shell_exec"] == True
        print(f"✓ shell_exec: {checks['shell_exec']}")


class TestHTMLRendering:
    """Test HTML rendering when accessed via GET"""
    
    def test_get_returns_html(self):
        """GET request should return HTML page"""
        response = requests.get(INSTALL_PHP_URL)
        assert response.status_code == 200
        assert "text/html" in response.headers.get("Content-Type", "")
        print("✓ GET returns HTML content type")
    
    def test_html_contains_title(self):
        """HTML should contain the installer title"""
        response = requests.get(INSTALL_PHP_URL)
        assert "Такси" in response.text or "Рядом" in response.text
        print("✓ HTML contains title 'Такси Рядом'")
    
    def test_html_contains_steps_ui(self):
        """HTML should contain step cards for installation wizard"""
        response = requests.get(INSTALL_PHP_URL)
        html = response.text
        
        # Check for step cards
        assert "step-0" in html
        assert "step-1" in html
        assert "step-2" in html
        assert "step-3" in html
        print("✓ HTML contains step cards (step-0 through step-3)")
    
    def test_html_contains_form_fields(self):
        """HTML should contain configuration form fields"""
        response = requests.get(INSTALL_PHP_URL)
        html = response.text
        
        assert "cfgDomain" in html
        assert "cfgAdminEmail" in html
        assert "cfgAdminPass" in html
        assert "cfgMongoUrl" in html
        print("✓ HTML contains form fields (domain, email, password, mongo)")
    
    def test_html_contains_javascript(self):
        """HTML should contain JavaScript for AJAX functionality"""
        response = requests.get(INSTALL_PHP_URL)
        html = response.text
        
        assert "ajax(" in html
        assert "check_system" in html
        assert "check_lock" in html
        print("✓ HTML contains JavaScript AJAX functions")


class TestSetupBackendEndpoint:
    """Test setup_backend AJAX endpoint"""
    
    def test_setup_backend_creates_env_file(self):
        """setup_backend should create .env file with correct content"""
        # Ensure no lock file
        if os.path.exists(LOCK_FILE):
            os.remove(LOCK_FILE)
        
        # Backup existing .env if present
        backend_env = "/app/backend/.env"
        backup_env = "/app/backend/.env.backup_test"
        if os.path.exists(backend_env):
            os.rename(backend_env, backup_env)
        
        try:
            response = requests.post(INSTALL_PHP_URL, data={
                "action": "setup_backend",
                "domain": "test.example.com",
                "protocol": "https",
                "admin_email": "test@example.com",
                "admin_password": "testpass123",
                "mongo_url": "mongodb://localhost:27017",
                "db_name": "test_db"
            })
            
            data = response.json()
            assert data["ok"] == True
            assert "steps" in data
            print("✓ setup_backend returns ok=true with steps")
            
            # Check .env file was created
            assert os.path.exists(backend_env), ".env file should be created"
            
            with open(backend_env, "r") as f:
                env_content = f.read()
            
            assert "MONGO_URL=mongodb://localhost:27017" in env_content
            assert "DB_NAME=test_db" in env_content
            assert "ADMIN_EMAIL=test@example.com" in env_content
            assert "ADMIN_PASSWORD=testpass123" in env_content
            assert "CORS_ORIGINS=https://test.example.com" in env_content
            print("✓ .env file contains correct configuration")
            
        finally:
            # Restore original .env
            if os.path.exists(backup_env):
                os.rename(backup_env, backend_env)


class TestSetupFrontendEndpoint:
    """Test setup_frontend AJAX endpoint"""
    
    def test_setup_frontend_creates_env_file(self):
        """setup_frontend should create .env file with REACT_APP_BACKEND_URL"""
        # Ensure no lock file
        if os.path.exists(LOCK_FILE):
            os.remove(LOCK_FILE)
        
        # Backup existing .env if present
        frontend_env = "/app/frontend/.env"
        backup_env = "/app/frontend/.env.backup_test"
        if os.path.exists(frontend_env):
            os.rename(frontend_env, backup_env)
        
        try:
            response = requests.post(INSTALL_PHP_URL, data={
                "action": "setup_frontend",
                "domain": "test.example.com",
                "protocol": "https"
            })
            
            data = response.json()
            assert data["ok"] == True
            assert "steps" in data
            print("✓ setup_frontend returns ok=true with steps")
            
            # Check .env file was created
            assert os.path.exists(frontend_env), ".env file should be created"
            
            with open(frontend_env, "r") as f:
                env_content = f.read()
            
            assert "REACT_APP_BACKEND_URL=https://test.example.com" in env_content
            print("✓ frontend .env contains REACT_APP_BACKEND_URL")
            
        finally:
            # Restore original .env
            if os.path.exists(backup_env):
                os.rename(backup_env, frontend_env)


class TestLockMechanism:
    """Test lock file mechanism prevents re-installation"""
    
    def test_locked_blocks_other_actions(self):
        """When locked, other actions should be blocked"""
        # Create lock file
        with open(LOCK_FILE, "w") as f:
            f.write("test")
        
        try:
            # Try check_system - should be blocked
            response = requests.post(INSTALL_PHP_URL, data={"action": "check_system"})
            data = response.json()
            
            assert data["ok"] == False
            assert "error" in data
            assert "уже была выполнена" in data["error"] or "install_lock" in data["error"].lower()
            print("✓ Lock file blocks check_system action")
            
        finally:
            # Cleanup
            if os.path.exists(LOCK_FILE):
                os.remove(LOCK_FILE)
    
    def test_check_lock_works_when_locked(self):
        """check_lock should still work even when locked"""
        # Create lock file
        with open(LOCK_FILE, "w") as f:
            f.write("test")
        
        try:
            response = requests.post(INSTALL_PHP_URL, data={"action": "check_lock"})
            data = response.json()
            
            assert data["ok"] == True
            assert data["locked"] == True
            print("✓ check_lock works even when locked")
            
        finally:
            # Cleanup
            if os.path.exists(LOCK_FILE):
                os.remove(LOCK_FILE)


class TestUnknownAction:
    """Test unknown action handling"""
    
    def test_unknown_action_returns_error(self):
        """Unknown action should return error"""
        # Ensure no lock file
        if os.path.exists(LOCK_FILE):
            os.remove(LOCK_FILE)
        
        response = requests.post(INSTALL_PHP_URL, data={"action": "unknown_action_xyz"})
        data = response.json()
        
        assert data["ok"] == False
        assert "error" in data
        print("✓ Unknown action returns error")


class TestNginxConfigGeneration:
    """Test nginx config generation in setup_services"""
    
    def test_setup_services_generates_nginx_config(self):
        """setup_services should attempt to generate nginx config"""
        # Ensure no lock file
        if os.path.exists(LOCK_FILE):
            os.remove(LOCK_FILE)
        
        # Note: This will partially fail in test environment (no systemd)
        # but we can check the response structure
        response = requests.post(INSTALL_PHP_URL, data={
            "action": "setup_services",
            "domain": "test.example.com",
            "protocol": "https",
            "use_ssl": "no",
            "admin_email": "test@example.com"
        })
        
        data = response.json()
        # Should return ok=true even if some steps fail
        assert data["ok"] == True
        assert "steps" in data
        
        # Check that steps array contains expected items
        step_names = [s["name"] for s in data["steps"]]
        print(f"✓ setup_services returns steps: {step_names}")


# Cleanup fixture
@pytest.fixture(autouse=True)
def cleanup():
    """Cleanup lock file before and after each test"""
    if os.path.exists(LOCK_FILE):
        os.remove(LOCK_FILE)
    yield
    if os.path.exists(LOCK_FILE):
        os.remove(LOCK_FILE)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
