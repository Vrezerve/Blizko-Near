#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Taxi WebToApp
Tests all major API endpoints and functionality
"""

import requests
import sys
import json
from datetime import datetime

class TaxiAPITester:
    def __init__(self, base_url="https://order-sync-platform-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.customer_token = None
        self.driver_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "name": name,
            "success": success,
            "details": details
        })

    def make_request(self, method, endpoint, data=None, token=None, expected_status=200):
        """Make HTTP request with error handling"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            
            success = response.status_code == expected_status
            response_data = {}
            
            try:
                response_data = response.json()
            except:
                response_data = {"text": response.text}
            
            return success, response.status_code, response_data
            
        except requests.exceptions.RequestException as e:
            return False, 0, {"error": str(e)}

    def test_public_endpoints(self):
        """Test public endpoints that don't require authentication"""
        print("\n🔍 Testing Public Endpoints...")
        
        # Test public settings
        success, status, data = self.make_request('GET', 'settings/public')
        self.log_test(
            "Public Settings API", 
            success and 'terms_text' in data,
            f"Status: {status}, Keys: {list(data.keys()) if isinstance(data, dict) else 'Invalid response'}"
        )
        
        # Test driver stats
        success, status, data = self.make_request('GET', 'drivers/stats')
        self.log_test(
            "Driver Stats API",
            success and 'online' in data and 'busy' in data,
            f"Status: {status}, Data: {data}"
        )

    def test_admin_auth(self):
        """Test admin authentication"""
        print("\n🔍 Testing Admin Authentication...")
        
        # Test admin login
        login_data = {
            "email": "admin@taxi.local",
            "password": "admin123"
        }
        
        success, status, data = self.make_request('POST', 'admin/login', login_data)
        
        if success and 'token' in data:
            self.admin_token = data['token']
            self.log_test("Admin Login", True, f"Token received: {data['token'][:20]}...")
        else:
            self.log_test("Admin Login", False, f"Status: {status}, Response: {data}")
            return False
        
        # Test admin stats with token
        success, status, data = self.make_request('GET', 'admin/stats', token=self.admin_token)
        self.log_test(
            "Admin Stats Access",
            success and 'customers' in data and 'drivers' in data,
            f"Status: {status}, Stats: {data}"
        )
        
        return True

    def test_customer_auth_flow(self):
        """Test customer authentication flow"""
        print("\n🔍 Testing Customer Authentication Flow...")
        
        test_phone = "+79001234567"
        
        # Send verification code
        send_code_data = {
            "phone": test_phone,
            "role": "customer"
        }
        
        success, status, data = self.make_request('POST', 'auth/send-code', send_code_data)
        self.log_test(
            "Customer Send SMS Code",
            success and data.get('success'),
            f"Status: {status}, Response: {data}"
        )
        
        if not success:
            return False
        
        # Verify code
        verify_data = {
            "phone": test_phone,
            "code": "1234",
            "role": "customer"
        }
        
        success, status, data = self.make_request('POST', 'auth/verify-code', verify_data)
        
        if success and 'token' in data:
            self.customer_token = data['token']
            self.log_test("Customer Verify Code", True, f"Customer created/logged in")
        else:
            self.log_test("Customer Verify Code", False, f"Status: {status}, Response: {data}")
            return False
        
        # Test customer profile access
        success, status, data = self.make_request('GET', 'auth/me', token=self.customer_token)
        self.log_test(
            "Customer Profile Access",
            success and data.get('role') == 'customer',
            f"Status: {status}, User: {data}"
        )
        
        return True

    def test_driver_registration_flow(self):
        """Test driver registration and authentication flow"""
        print("\n🔍 Testing Driver Registration Flow...")
        
        test_phone = "+79007654321"
        
        # Check driver status (should not exist initially)
        check_data = {"phone": test_phone}
        success, status, data = self.make_request('POST', 'auth/check-driver', check_data)
        self.log_test(
            "Check Driver Status",
            success,
            f"Status: {status}, Exists: {data.get('exists', False)}, Activated: {data.get('activated', False)}"
        )
        
        # Register new driver if doesn't exist
        if not data.get('exists', False):
            register_data = {
                "phone": test_phone,
                "name": "Тестовый Водитель",
                "car_model": "Toyota Camry",
                "car_number": "А123БВ777",
                "agreed_terms": True,
                "agreed_privacy": True
            }
            
            success, status, data = self.make_request('POST', 'auth/register-driver', register_data)
            self.log_test(
                "Driver Registration",
                success and data.get('success'),
                f"Status: {status}, Response: {data}"
            )
        
        # Send verification code for driver first
        send_code_data = {
            "phone": test_phone,
            "role": "driver"
        }
        self.make_request('POST', 'auth/send-code', send_code_data)
        
        # Try to verify code (should fail if not activated)
        verify_data = {
            "phone": test_phone,
            "code": "1234",
            "role": "driver"
        }
        
        success, status, data = self.make_request('POST', 'auth/verify-code', verify_data, expected_status=403)
        self.log_test(
            "Driver Verify Code (Before Activation)",
            status == 403 and data.get('detail') == 'AWAITING_ACTIVATION',
            f"Status: {status}, Response: {data}"
        )

    def test_admin_driver_management(self):
        """Test admin driver management functions"""
        if not self.admin_token:
            print("⚠️ Skipping admin driver management tests - no admin token")
            return
        
        print("\n🔍 Testing Admin Driver Management...")
        
        # Get all drivers
        success, status, data = self.make_request('GET', 'admin/users?role=driver', token=self.admin_token)
        self.log_test(
            "Get All Drivers",
            success and isinstance(data, list),
            f"Status: {status}, Driver count: {len(data) if isinstance(data, list) else 'Invalid'}"
        )
        
        if success and isinstance(data, list) and len(data) > 0:
            # Find unactivated driver
            unactivated_driver = None
            for driver in data:
                if not driver.get('is_activated', True):
                    unactivated_driver = driver
                    break
            
            if unactivated_driver:
                driver_id = unactivated_driver['id']
                
                # Activate driver
                success, status, data = self.make_request('POST', f'admin/users/{driver_id}/activate', token=self.admin_token)
                self.log_test(
                    "Activate Driver",
                    success and data.get('success'),
                    f"Status: {status}, Response: {data}"
                )
                
                # Now try driver login after activation
                verify_data = {
                    "phone": "+79007654321",
                    "code": "1234",
                    "role": "driver"
                }
                
                # Send code first
                send_code_data = {
                    "phone": "+79007654321",
                    "role": "driver"
                }
                self.make_request('POST', 'auth/send-code', send_code_data)
                
                # Verify code
                success, status, data = self.make_request('POST', 'auth/verify-code', verify_data)
                
                if success and 'token' in data:
                    self.driver_token = data['token']
                    self.log_test("Driver Login After Activation", True, "Driver successfully logged in")
                else:
                    self.log_test("Driver Login After Activation", False, f"Status: {status}, Response: {data}")

    def test_order_flow(self):
        """Test order creation and management"""
        if not self.customer_token:
            print("⚠️ Skipping order tests - no customer token")
            return
        
        print("\n🔍 Testing Order Management...")
        
        # Create order as customer
        order_data = {
            "address": "Тестовая улица, 123",
            "house_number": "45А"
        }
        
        success, status, data = self.make_request('POST', 'orders/create', order_data, token=self.customer_token)
        self.log_test(
            "Create Order",
            success and 'id' in data,
            f"Status: {status}, Response: {data}, Order ID: {data.get('id', 'None')[:8] if data.get('id') else 'None'}"
        )
        
        if success and 'id' in data:
            order_id = data['id']
            
            # Get customer's orders
            success, status, data = self.make_request('GET', 'orders/my-orders', token=self.customer_token)
            self.log_test(
                "Get Customer Orders",
                success and isinstance(data, list) and len(data) > 0,
                f"Status: {status}, Order count: {len(data) if isinstance(data, list) else 'Invalid'}"
            )
            
            # Get active orders
            success, status, data = self.make_request('GET', 'orders/active', token=self.customer_token)
            self.log_test(
                "Get Active Orders",
                success,
                f"Status: {status}, Active order: {data.get('id', 'None')[:8] if data and data.get('id') else 'None'}"
            )

    def test_settings_management(self):
        """Test settings management"""
        if not self.admin_token:
            print("⚠️ Skipping settings tests - no admin token")
            return
        
        print("\n🔍 Testing Settings Management...")
        
        # Get current settings
        success, status, data = self.make_request('GET', 'settings/', token=self.admin_token)
        self.log_test(
            "Get Admin Settings",
            success,
            f"Status: {status}, Settings keys: {list(data.keys()) if isinstance(data, dict) else 'Invalid'}"
        )
        
        # Update settings
        settings_update = {
            "maintenance_mode": False,
            "maintenance_text": "Test maintenance message",
            "sms_ru_api_key": "test_key_123"
        }
        
        success, status, data = self.make_request('POST', 'settings/', settings_update, token=self.admin_token)
        self.log_test(
            "Update Settings",
            success and data.get('success'),
            f"Status: {status}, Response: {data}"
        )

    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting Taxi WebToApp Backend API Tests")
        print(f"📍 Testing against: {self.base_url}")
        print("=" * 60)
        
        # Test public endpoints first
        self.test_public_endpoints()
        
        # Test admin authentication
        admin_auth_success = self.test_admin_auth()
        
        # Test customer flow
        customer_auth_success = self.test_customer_auth_flow()
        
        # Test driver registration
        self.test_driver_registration_flow()
        
        # Test admin driver management (requires admin auth)
        if admin_auth_success:
            self.test_admin_driver_management()
        
        # Test order flow (requires customer auth)
        if customer_auth_success:
            self.test_order_flow()
        
        # Test settings management (requires admin auth)
        if admin_auth_success:
            self.test_settings_management()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("⚠️ Some tests failed. Check the details above.")
            
            # Print failed tests
            failed_tests = [t for t in self.test_results if not t['success']]
            if failed_tests:
                print("\n❌ Failed Tests:")
                for test in failed_tests:
                    print(f"  - {test['name']}: {test['details']}")
            
            return 1

def main():
    """Main test runner"""
    tester = TaxiAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())