#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Taxi WebToApp
Tests all major API endpoints and functionality including driver tracking
"""

import requests
import sys
import json
import time
import websocket
import threading
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
            
            # Handle multiple expected status codes
            if isinstance(expected_status, list):
                success = response.status_code in expected_status
            else:
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
            self.customer_id = data.get('user', {}).get('id')
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
        
        success, status, data = self.make_request('POST', 'auth/verify-code', verify_data, expected_status=[200, 403])
        
        if status == 200 and data.get('token'):
            # Driver is already activated
            self.driver_token = data['token']
            self.driver_id = data.get('user', {}).get('id')
            self.log_test("Driver Verify Code (Already Activated)", True, "Driver already activated and logged in")
        elif status == 403 and data.get('detail') == 'AWAITING_ACTIVATION':
            self.log_test("Driver Verify Code (Before Activation)", True, "Correctly blocked unactivated driver")
        else:
            self.log_test(
                "Driver Verify Code (Before Activation)",
                False,
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
        
        # First, cancel any existing active orders
        success, status, data = self.make_request('GET', 'orders/active', token=self.customer_token)
        if success and data and data.get('id'):
            # Cancel existing order
            cancel_success, cancel_status, cancel_data = self.make_request('POST', f'orders/cancel/{data["id"]}', token=self.customer_token)
            if cancel_success:
                print("   Cancelled existing active order")
                time.sleep(1)  # Wait a moment before creating new order
        
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
            self.order_id = data['id']  # Store order ID for driver tracking tests
            
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
        
        # Driver tracking specific tests
        self.test_order_acceptance_by_driver()
        self.test_driver_location_update()
        self.test_customer_get_driver_location()
        self.test_driver_location_broadcasting()
        self.test_websocket_driver_tracking()
        
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

    def test_order_acceptance_by_driver(self):
        """Test driver accepting order for tracking tests"""
        if not self.driver_token or not hasattr(self, 'order_id') or not self.order_id:
            self.log_test("Order Acceptance by Driver", False, "Missing driver token or order ID")
            return
        
        # Driver goes online first
        success, status, data = self.make_request('POST', 'drivers/toggle-ready', {}, self.driver_token)
        if success:
            print("   Driver went online")
        
        # Driver accepts the order
        success, status, data = self.make_request('POST', f'orders/accept/{self.order_id}', {}, self.driver_token)
        
        if success:
            self.log_test("Order Acceptance by Driver", True, "Driver accepted order for tracking")
        else:
            self.log_test("Order Acceptance by Driver", False, f"Status: {status}, Response: {data}")

    def test_driver_location_update(self):
        """Test driver location update API"""
        if not self.driver_token:
            self.log_test("Driver Location Update", False, "No driver token")
            return
        
        test_location = {
            'lat': 55.7558,
            'lng': 37.6173
        }
        
        success, status, data = self.make_request('POST', 'drivers/update-location', test_location, self.driver_token)
        
        if success:
            self.log_test("Driver Location Update", True)
        else:
            self.log_test("Driver Location Update", False, f"Status: {status}, Response: {data}")

    def test_customer_get_driver_location(self):
        """Test customer getting driver location"""
        if not self.customer_token or not hasattr(self, 'driver_id'):
            self.log_test("Customer Get Driver Location", False, "Missing tokens or driver ID")
            return
        
        # First ensure driver has location
        test_location = {
            'lat': 55.7560,
            'lng': 37.6175
        }
        self.make_request('POST', 'drivers/update-location', test_location, self.driver_token)
        
        # Customer gets driver location
        success, status, data = self.make_request('GET', f'drivers/location/{self.driver_id}', token=self.customer_token)
        
        if success:
            if 'location' in data and 'eta_minutes' in data:
                self.log_test("Customer Get Driver Location", True, f"ETA: {data.get('eta_minutes')} minutes")
            else:
                self.log_test("Customer Get Driver Location", False, "Missing location or ETA data")
        else:
            self.log_test("Customer Get Driver Location", False, f"Status: {status}, Response: {data}")

    def test_driver_location_broadcasting(self):
        """Test driver location update broadcasting"""
        if not self.driver_token:
            self.log_test("Driver Location Broadcasting", False, "No driver token")
            return
        
        # Update driver location multiple times to simulate movement
        locations = [
            {'lat': 55.7560, 'lng': 37.6175},
            {'lat': 55.7555, 'lng': 37.6180},
            {'lat': 55.7550, 'lng': 37.6185}
        ]
        
        success_count = 0
        for location in locations:
            success, status, data = self.make_request('POST', 'drivers/update-location', location, self.driver_token)
            if success:
                success_count += 1
                time.sleep(0.5)  # Small delay between updates
        
        if success_count == len(locations):
            self.log_test("Driver Location Broadcasting", True, f"Updated {success_count} locations")
        else:
            self.log_test("Driver Location Broadcasting", False, f"Only {success_count}/{len(locations)} updates succeeded")

    def test_websocket_driver_tracking(self):
        """Test WebSocket connection for real-time driver tracking"""
        if not hasattr(self, 'customer_id') or not self.customer_id:
            self.log_test("WebSocket Driver Tracking", False, "No customer ID")
            return
        
        try:
            ws_url = "wss://order-sync-platform-1.preview.emergentagent.com/ws/" + self.customer_id
            ws_messages = []
            ws_connected = False
            
            def on_message(ws, message):
                try:
                    data = json.loads(message)
                    ws_messages.append(data)
                    print(f"📡 WebSocket message: {data.get('type', 'unknown')}")
                except:
                    pass
            
            def on_open(ws):
                nonlocal ws_connected
                ws_connected = True
                print("📡 WebSocket connected")
            
            def on_error(ws, error):
                print(f"📡 WebSocket error: {error}")
            
            def on_close(ws, close_status_code, close_msg):
                nonlocal ws_connected
                ws_connected = False
                print("📡 WebSocket closed")
            
            ws = websocket.WebSocketApp(ws_url,
                                      on_open=on_open,
                                      on_message=on_message,
                                      on_error=on_error,
                                      on_close=on_close)
            
            # Run WebSocket in background thread
            ws_thread = threading.Thread(target=ws.run_forever)
            ws_thread.daemon = True
            ws_thread.start()
            
            # Wait for connection
            time.sleep(2)
            
            if ws_connected:
                # Test driver location update with WebSocket
                test_location = {'lat': 55.7565, 'lng': 37.6170}
                success, status, data = self.make_request('POST', 'drivers/update-location', test_location, self.driver_token)
                
                # Wait for WebSocket message
                time.sleep(3)
                
                # Check if we received driver_location message
                driver_location_messages = [msg for msg in ws_messages if msg.get('type') == 'driver_location']
                if driver_location_messages:
                    self.log_test("WebSocket Driver Tracking", True, f"Received {len(driver_location_messages)} location updates")
                else:
                    self.log_test("WebSocket Driver Tracking", False, "No driver location messages received")
                
                ws.close()
            else:
                self.log_test("WebSocket Driver Tracking", False, "Failed to connect to WebSocket")
                
        except Exception as e:
            self.log_test("WebSocket Driver Tracking", False, f"Exception: {str(e)}")

def main():
    """Main test runner"""
    tester = TaxiAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())