from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, WebSocket, WebSocketDisconnect
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import secrets
import json
import asyncio

ROOT_DIR = Path(__file__).parent

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get("JWT_SECRET", secrets.token_hex(32))
JWT_ALGORITHM = "HS256"

# Create the main app
app = FastAPI(title="Taxi WebToApp API")

# Create routers
api_router = APIRouter(prefix="/api")
auth_router = APIRouter(prefix="/auth", tags=["auth"])
orders_router = APIRouter(prefix="/orders", tags=["orders"])
drivers_router = APIRouter(prefix="/drivers", tags=["drivers"])
customers_router = APIRouter(prefix="/customers", tags=["customers"])
admin_router = APIRouter(prefix="/admin", tags=["admin"])
settings_router = APIRouter(prefix="/settings", tags=["settings"])

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# WebSocket connections manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
    
    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
    
    async def send_to_user(self, user_id: str, message: dict):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(message)
            except:
                self.disconnect(user_id)
    
    async def broadcast_to_drivers(self, message: dict, exclude_id: str = None):
        for user_id, ws in list(self.active_connections.items()):
            if user_id != exclude_id:
                try:
                    await ws.send_json(message)
                except:
                    self.disconnect(user_id)

manager = ConnectionManager()

# ============ MODELS ============

class UserBase(BaseModel):
    phone: str
    role: str  # customer, driver, admin
    name: Optional[str] = None
    avatar: Optional[str] = None

class CustomerCreate(BaseModel):
    phone: str
    agreed_terms: bool = False
    agreed_privacy: bool = False

class DriverCreate(BaseModel):
    phone: str
    name: str
    car_model: str
    car_number: str
    agreed_terms: bool = False
    agreed_privacy: bool = False

class VerifyCode(BaseModel):
    phone: str
    code: str
    role: str

class UserResponse(BaseModel):
    id: str
    phone: str
    role: str
    name: Optional[str] = None
    avatar: Optional[str] = None
    is_activated: bool = True
    is_online: bool = False
    is_busy: bool = False
    car_model: Optional[str] = None
    car_number: Optional[str] = None
    balance: int = 999
    total_orders: int = 0
    cancelled_orders: int = 0
    admin_notes: Optional[str] = None
    is_reliable: bool = False
    created_at: Optional[str] = None

class OrderCreate(BaseModel):
    address: str
    house_number: str

class OrderResponse(BaseModel):
    id: str
    customer_id: str
    customer_phone: str
    address: str
    house_number: str
    status: str  # pending, accepted, completed, cancelled, problem
    driver_id: Optional[str] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    driver_car: Optional[str] = None
    driver_car_number: Optional[str] = None
    problem_reason: Optional[str] = None
    problem_text: Optional[str] = None
    created_at: str
    accepted_at: Optional[str] = None
    completed_at: Optional[str] = None

class ProblemReport(BaseModel):
    order_id: str
    reason: str
    text: Optional[str] = None

class SettingsUpdate(BaseModel):
    sms_ru_api_key: Optional[str] = None
    onesignal_app_id: Optional[str] = None
    onesignal_api_key: Optional[str] = None
    yandex_map_api_key: Optional[str] = None
    google_map_api_key: Optional[str] = None
    twogis_api_key: Optional[str] = None
    active_map_provider: Optional[str] = "yandex"
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from_email: Optional[str] = None
    admin_email: Optional[str] = None
    terms_text: Optional[str] = None
    privacy_text: Optional[str] = None
    customer_rules_text: Optional[str] = None
    driver_rules_text: Optional[str] = None
    maintenance_mode: bool = False
    maintenance_text: Optional[str] = None

class AdminLogin(BaseModel):
    email: str
    password: str

class MessageTemplate(BaseModel):
    key: str
    text: str

# ============ HELPERS ============

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def create_access_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
        "type": "access"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user.pop("_id", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_admin_user(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def log_action(action: str, user_id: str = None, details: dict = None):
    log_entry = {
        "id": str(uuid.uuid4()),
        "action": action,
        "user_id": user_id,
        "details": details or {},
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.logs.insert_one(log_entry)

async def send_notification(user_id: str, title: str, message: str, notification_type: str = "push"):
    """Mock notification - logs to DB for admin review"""
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": notification_type,
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending"
    }
    await db.notifications.insert_one(notification)
    await log_action("notification_sent", user_id, {"title": title, "type": notification_type})
    return notification

# ============ AUTH ROUTES ============

@auth_router.post("/send-code")
async def send_verification_code(data: dict):
    phone = data.get("phone")
    role = data.get("role")
    
    if not phone or not role:
        raise HTTPException(status_code=400, detail="Phone and role required")
    
    # Generate 4-digit code
    code = "1234"  # Mock code for testing, in production: str(random.randint(1000, 9999))
    
    # Store code in DB
    await db.verification_codes.delete_many({"phone": phone})
    await db.verification_codes.insert_one({
        "phone": phone,
        "code": code,
        "role": role,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    })
    
    # Log SMS sending
    await log_action("sms_sent", None, {"phone": phone, "code": code})
    await send_notification(phone, "Код подтверждения", f"Ваш код: {code}", "sms")
    
    return {"success": True, "message": "Code sent"}

@auth_router.post("/verify-code")
async def verify_code(data: VerifyCode):
    verification = await db.verification_codes.find_one({
        "phone": data.phone,
        "code": data.code,
        "role": data.role
    })
    
    if not verification:
        raise HTTPException(status_code=400, detail="Invalid code")
    
    # Check if code expired
    expires_at = datetime.fromisoformat(verification["expires_at"])
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Code expired")
    
    # Find or check user
    user = await db.users.find_one({"phone": data.phone, "role": data.role})
    
    if data.role == "customer":
        if not user:
            # Create new customer
            user = {
                "id": str(uuid.uuid4()),
                "phone": data.phone,
                "role": "customer",
                "name": None,
                "avatar": None,
                "is_activated": True,
                "total_orders": 0,
                "cancelled_orders": 0,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(user)
            await log_action("customer_registered", user["id"], {"phone": data.phone})
    elif data.role == "driver":
        if not user:
            raise HTTPException(status_code=400, detail="Driver not registered")
        if not user.get("is_activated", False):
            raise HTTPException(status_code=403, detail="AWAITING_ACTIVATION")
    
    # Delete used code
    await db.verification_codes.delete_many({"phone": data.phone})
    
    # Create token
    token = create_access_token(user["id"], user["role"])
    user.pop("_id", None)
    
    await log_action("user_login", user["id"], {"phone": data.phone, "role": data.role})
    
    return {"token": token, "user": user}

@auth_router.post("/register-driver")
async def register_driver(data: DriverCreate):
    if not data.agreed_terms or not data.agreed_privacy:
        raise HTTPException(status_code=400, detail="Must agree to terms and privacy policy")
    
    # Check if driver already exists
    existing = await db.users.find_one({"phone": data.phone, "role": "driver"})
    if existing:
        raise HTTPException(status_code=400, detail="Driver already registered")
    
    # Create driver (not activated)
    driver = {
        "id": str(uuid.uuid4()),
        "phone": data.phone,
        "role": "driver",
        "name": data.name,
        "car_model": data.car_model,
        "car_number": data.car_number,
        "avatar": None,
        "is_activated": False,
        "is_online": False,
        "is_busy": False,
        "balance": 999,
        "total_orders": 0,
        "cancelled_orders": 0,
        "completed_orders": 0,
        "problem_orders": 0,
        "is_reliable": False,
        "admin_notes": "",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(driver)
    await log_action("driver_registered", driver["id"], {"phone": data.phone, "name": data.name})
    
    return {"success": True, "message": "Registration submitted. Awaiting activation."}

@auth_router.post("/check-driver")
async def check_driver_status(data: dict):
    phone = data.get("phone")
    driver = await db.users.find_one({"phone": phone, "role": "driver"})
    
    if not driver:
        return {"exists": False, "activated": False}
    
    return {
        "exists": True,
        "activated": driver.get("is_activated", False)
    }

@auth_router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user

@auth_router.post("/logout")
async def logout():
    return {"success": True}

# ============ ORDERS ROUTES ============

@orders_router.post("/create")
async def create_order(data: OrderCreate, user: dict = Depends(get_current_user)):
    if user["role"] != "customer":
        raise HTTPException(status_code=403, detail="Only customers can create orders")
    
    # Check for existing pending order
    existing = await db.orders.find_one({
        "customer_id": user["id"],
        "status": {"$in": ["pending", "accepted"]}
    })
    if existing:
        raise HTTPException(status_code=400, detail="You already have an active order")
    
    # Check if user is blocked from ordering (3 min cooldown after cancellation)
    last_cancelled = await db.orders.find_one({
        "customer_id": user["id"],
        "status": "cancelled",
        "cancelled_by": "customer_after_accept"
    }, sort=[("cancelled_at", -1)])
    
    if last_cancelled:
        cancelled_time = datetime.fromisoformat(last_cancelled["cancelled_at"])
        if datetime.now(timezone.utc) - cancelled_time < timedelta(minutes=3):
            remaining = 180 - int((datetime.now(timezone.utc) - cancelled_time).total_seconds())
            raise HTTPException(status_code=400, detail=f"BLOCKED:{remaining}")
    
    order = {
        "id": str(uuid.uuid4()),
        "customer_id": user["id"],
        "customer_phone": user["phone"],
        "address": data.address,
        "house_number": data.house_number,
        "status": "pending",
        "driver_id": None,
        "driver_name": None,
        "driver_phone": None,
        "driver_car": None,
        "driver_car_number": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "accepted_at": None,
        "completed_at": None,
        "problem_reason": None,
        "problem_text": None
    }
    await db.orders.insert_one(order)
    await log_action("order_created", user["id"], {"order_id": order["id"], "address": data.address})
    
    # Notify all online drivers
    await manager.broadcast_to_drivers({"type": "new_order", "order": order})
    
    # Send push to all online drivers
    online_drivers = await db.users.find({"role": "driver", "is_online": True, "is_busy": False}).to_list(100)
    for driver in online_drivers:
        await send_notification(driver["id"], "Новая заявка", f"Адрес: {data.address}", "push")
    
    order.pop("_id", None)
    return order

@orders_router.get("/my-orders")
async def get_my_orders(user: dict = Depends(get_current_user)):
    if user["role"] == "customer":
        orders = await db.orders.find({"customer_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    else:
        orders = await db.orders.find({"driver_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return orders

@orders_router.get("/active")
async def get_active_orders(user: dict = Depends(get_current_user)):
    if user["role"] == "customer":
        order = await db.orders.find_one({
            "customer_id": user["id"],
            "status": {"$in": ["pending", "accepted"]}
        }, {"_id": 0})
        return order
    elif user["role"] == "driver":
        # Return driver's current order if busy
        if user.get("is_busy"):
            order = await db.orders.find_one({
                "driver_id": user["id"],
                "status": "accepted"
            }, {"_id": 0})
            return {"current_order": order, "available_orders": []}
        
        # Return all pending orders for available drivers
        orders = await db.orders.find({"status": "pending"}, {"_id": 0}).to_list(100)
        return {"current_order": None, "available_orders": orders}
    return None

@orders_router.post("/accept/{order_id}")
async def accept_order(order_id: str, user: dict = Depends(get_current_user)):
    if user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can accept orders")
    
    if not user.get("is_activated"):
        raise HTTPException(status_code=403, detail="Driver not activated")
    
    if user.get("is_busy"):
        raise HTTPException(status_code=400, detail="You already have an active order")
    
    # Check balance
    balance = user.get("balance", 0)
    is_reliable = user.get("is_reliable", False)
    min_balance = -20 if is_reliable else 0
    
    if balance <= min_balance:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    # Try to accept order
    result = await db.orders.find_one_and_update(
        {"id": order_id, "status": "pending"},
        {"$set": {
            "status": "accepted",
            "driver_id": user["id"],
            "driver_name": user.get("name"),
            "driver_phone": user["phone"],
            "driver_car": user.get("car_model"),
            "driver_car_number": user.get("car_number"),
            "accepted_at": datetime.now(timezone.utc).isoformat()
        }},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=400, detail="Order no longer available")
    
    # Update driver status and deduct balance
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"is_busy": True}, "$inc": {"balance": -1}}
    )
    
    await log_action("order_accepted", user["id"], {"order_id": order_id})
    
    # Notify customer
    await manager.send_to_user(result["customer_id"], {
        "type": "order_accepted",
        "order": {k: v for k, v in result.items() if k != "_id"}
    })
    await send_notification(result["customer_id"], "Водитель найден", f"Водитель {user.get('name')} едет к вам", "push")
    
    # Notify other drivers that order is taken
    await manager.broadcast_to_drivers({"type": "order_taken", "order_id": order_id}, user["id"])
    
    result.pop("_id", None)
    return result

@orders_router.post("/complete/{order_id}")
async def complete_order(order_id: str, user: dict = Depends(get_current_user)):
    if user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can complete orders")
    
    order = await db.orders.find_one({"id": order_id, "driver_id": user["id"], "status": "accepted"})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check 2 minute minimum
    accepted_at = datetime.fromisoformat(order["accepted_at"])
    if datetime.now(timezone.utc) - accepted_at < timedelta(minutes=2):
        remaining = 120 - int((datetime.now(timezone.utc) - accepted_at).total_seconds())
        raise HTTPException(status_code=400, detail=f"WAIT:{remaining}")
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Update driver and customer stats
    await db.users.update_one({"id": user["id"]}, {"$set": {"is_busy": False}, "$inc": {"completed_orders": 1}})
    await db.users.update_one({"id": order["customer_id"]}, {"$inc": {"total_orders": 1}})
    
    await log_action("order_completed", user["id"], {"order_id": order_id})
    
    # Notify customer
    await manager.send_to_user(order["customer_id"], {"type": "order_completed", "order_id": order_id})
    
    return {"success": True}

@orders_router.post("/cancel/{order_id}")
async def cancel_order(order_id: str, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if user["role"] == "customer" and order["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your order")
    
    if user["role"] == "driver" and order["driver_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your order")
    
    cancelled_by = "customer" if user["role"] == "customer" else "driver"
    if order["status"] == "accepted" and user["role"] == "customer":
        cancelled_by = "customer_after_accept"
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_by": cancelled_by,
            "cancelled_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # If driver cancelled, refund balance and free driver
    if user["role"] == "driver" and order["status"] == "accepted":
        await db.users.update_one({"id": user["id"]}, {"$set": {"is_busy": False}, "$inc": {"balance": 1, "cancelled_orders": 1}})
    
    # If customer cancelled after acceptance, increment their cancelled count
    if cancelled_by == "customer_after_accept":
        await db.users.update_one({"id": user["id"]}, {"$inc": {"cancelled_orders": 1}})
        if order.get("driver_id"):
            await db.users.update_one({"id": order["driver_id"]}, {"$set": {"is_busy": False}, "$inc": {"balance": 1}})
    
    await log_action("order_cancelled", user["id"], {"order_id": order_id, "cancelled_by": cancelled_by})
    
    return {"success": True}

@orders_router.post("/problem/{order_id}")
async def report_problem(order_id: str, data: ProblemReport, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    reporter_type = "driver" if user["role"] == "driver" else "customer"
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": "problem",
            "problem_reason": data.reason,
            "problem_text": data.text,
            "problem_reporter": reporter_type,
            "problem_reporter_id": user["id"]
        }}
    )
    
    # Refund driver balance for problem orders
    if order.get("driver_id"):
        await db.users.update_one({"id": order["driver_id"]}, {"$set": {"is_busy": False}, "$inc": {"balance": 1, "problem_orders": 1}})
    
    await log_action("order_problem", user["id"], {"order_id": order_id, "reason": data.reason, "reporter": reporter_type})
    
    # Send email notification to admin
    settings = await db.settings.find_one({"id": "main"})
    if settings and settings.get("admin_email"):
        await send_notification(
            "admin",
            f"Проблемная заявка #{order_id[:8]}",
            f"Причина: {data.reason}\nОт: {reporter_type}\nТекст: {data.text or 'Не указан'}",
            "email"
        )
    
    return {"success": True}

# ============ DRIVER ROUTES ============

@drivers_router.post("/toggle-ready")
async def toggle_ready(user: dict = Depends(get_current_user)):
    if user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers")
    
    if not user.get("is_activated"):
        raise HTTPException(status_code=403, detail="Not activated")
    
    new_status = not user.get("is_online", False)
    await db.users.update_one({"id": user["id"]}, {"$set": {"is_online": new_status}})
    
    await log_action("driver_status_change", user["id"], {"is_online": new_status})
    
    return {"is_online": new_status}

@drivers_router.get("/stats")
async def get_driver_stats():
    online_count = await db.users.count_documents({"role": "driver", "is_online": True, "is_activated": True})
    busy_count = await db.users.count_documents({"role": "driver", "is_online": True, "is_busy": True})
    return {"online": online_count, "busy": busy_count, "available": online_count - busy_count}

# ============ ADMIN ROUTES ============

@admin_router.post("/login")
async def admin_login(data: AdminLogin):
    admin = await db.users.find_one({"email": data.email, "role": "admin"})
    if not admin or not verify_password(data.password, admin.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token(admin["id"], "admin")
    admin.pop("_id", None)
    admin.pop("password_hash", None)
    
    await log_action("admin_login", admin["id"], {"email": data.email})
    
    return {"token": token, "user": admin}

@admin_router.get("/users")
async def get_all_users(role: Optional[str] = None, user: dict = Depends(get_admin_user)):
    query = {} if not role else {"role": role}
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users

@admin_router.get("/users/{user_id}")
async def get_user_details(user_id: str, user: dict = Depends(get_admin_user)):
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get user's orders
    orders = await db.orders.find(
        {"$or": [{"customer_id": user_id}, {"driver_id": user_id}]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Get user's logs
    logs = await db.logs.find({"user_id": user_id}, {"_id": 0}).sort("timestamp", -1).to_list(50)
    
    return {"user": target_user, "orders": orders, "logs": logs}

@admin_router.post("/users/{user_id}/activate")
async def activate_driver(user_id: str, user: dict = Depends(get_admin_user)):
    result = await db.users.update_one(
        {"id": user_id, "role": "driver"},
        {"$set": {"is_activated": True}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    await log_action("driver_activated", user_id, {"activated_by": user["id"]})
    
    # Notify driver
    await send_notification(user_id, "Аккаунт активирован", "Ваш аккаунт водителя активирован!", "push")
    
    return {"success": True}

@admin_router.post("/users/{user_id}/deactivate")
async def deactivate_driver(user_id: str, user: dict = Depends(get_admin_user)):
    await db.users.update_one({"id": user_id}, {"$set": {"is_activated": False, "is_online": False}})
    await log_action("driver_deactivated", user_id, {"deactivated_by": user["id"]})
    return {"success": True}

@admin_router.post("/users/{user_id}/update")
async def update_user(user_id: str, data: dict, user: dict = Depends(get_admin_user)):
    allowed_fields = ["name", "balance", "admin_notes", "is_reliable", "car_model", "car_number"]
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    await log_action("user_updated", user_id, {"updated_by": user["id"], "fields": list(update_data.keys())})
    
    return {"success": True}

@admin_router.get("/orders")
async def get_all_orders(status: Optional[str] = None, user: dict = Depends(get_admin_user)):
    query = {} if not status else {"status": status}
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return orders

@admin_router.get("/logs")
async def get_logs(action: Optional[str] = None, limit: int = 100, user: dict = Depends(get_admin_user)):
    query = {} if not action else {"action": action}
    logs = await db.logs.find(query, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return logs

@admin_router.get("/notifications")
async def get_notifications(notification_type: Optional[str] = None, user: dict = Depends(get_admin_user)):
    query = {} if not notification_type else {"type": notification_type}
    notifications = await db.notifications.find(query, {"_id": 0}).sort("sent_at", -1).to_list(200)
    return notifications

@admin_router.get("/stats")
async def get_admin_stats(user: dict = Depends(get_admin_user)):
    total_customers = await db.users.count_documents({"role": "customer"})
    total_drivers = await db.users.count_documents({"role": "driver"})
    activated_drivers = await db.users.count_documents({"role": "driver", "is_activated": True})
    pending_drivers = await db.users.count_documents({"role": "driver", "is_activated": False})
    online_drivers = await db.users.count_documents({"role": "driver", "is_online": True})
    
    total_orders = await db.orders.count_documents({})
    completed_orders = await db.orders.count_documents({"status": "completed"})
    problem_orders = await db.orders.count_documents({"status": "problem"})
    pending_orders = await db.orders.count_documents({"status": "pending"})
    
    return {
        "customers": total_customers,
        "drivers": {
            "total": total_drivers,
            "activated": activated_drivers,
            "pending": pending_drivers,
            "online": online_drivers
        },
        "orders": {
            "total": total_orders,
            "completed": completed_orders,
            "problem": problem_orders,
            "pending": pending_orders
        }
    }

# ============ SETTINGS ROUTES ============

@settings_router.get("/")
async def get_settings(user: dict = Depends(get_admin_user)):
    settings = await db.settings.find_one({"id": "main"}, {"_id": 0})
    if not settings:
        settings = {"id": "main"}
    return settings

@settings_router.post("/")
async def update_settings(data: SettingsUpdate, user: dict = Depends(get_admin_user)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["id"] = "main"
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.settings.update_one(
        {"id": "main"},
        {"$set": update_data},
        upsert=True
    )
    
    await log_action("settings_updated", user["id"], {"fields": list(update_data.keys())})
    
    return {"success": True}

@settings_router.get("/public")
async def get_public_settings():
    """Get settings that are public (terms, rules, maintenance mode)"""
    settings = await db.settings.find_one({"id": "main"}, {"_id": 0})
    if not settings:
        return {
            "maintenance_mode": False,
            "maintenance_text": "",
            "terms_text": "Условия использования сервиса...",
            "privacy_text": "Политика конфиденциальности...",
            "customer_rules_text": "Правила для пассажиров...",
            "driver_rules_text": "Правила для водителей..."
        }
    
    return {
        "maintenance_mode": settings.get("maintenance_mode", False),
        "maintenance_text": settings.get("maintenance_text", ""),
        "terms_text": settings.get("terms_text", "Условия использования сервиса..."),
        "privacy_text": settings.get("privacy_text", "Политика конфиденциальности..."),
        "customer_rules_text": settings.get("customer_rules_text", "Правила для пассажиров..."),
        "driver_rules_text": settings.get("driver_rules_text", "Правила для водителей...")
    }

@settings_router.get("/messages")
async def get_message_templates(user: dict = Depends(get_admin_user)):
    messages = await db.message_templates.find({}, {"_id": 0}).to_list(100)
    return messages

@settings_router.post("/messages")
async def update_message_template(data: MessageTemplate, user: dict = Depends(get_admin_user)):
    await db.message_templates.update_one(
        {"key": data.key},
        {"$set": {"text": data.text, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    return {"success": True}

# ============ WEBSOCKET ============

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle ping/pong for connection keep-alive
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(user_id)

# ============ INCLUDE ROUTERS ============

api_router.include_router(auth_router)
api_router.include_router(orders_router)
api_router.include_router(drivers_router)
api_router.include_router(customers_router)
api_router.include_router(admin_router)
api_router.include_router(settings_router)
app.include_router(api_router)

# ============ CORS ============

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============ STARTUP ============

@app.on_event("startup")
async def startup():
    # Create indexes
    await db.users.create_index("phone")
    await db.users.create_index("id", unique=True)
    await db.users.create_index("email", sparse=True)
    await db.orders.create_index("id", unique=True)
    await db.orders.create_index("customer_id")
    await db.orders.create_index("driver_id")
    await db.orders.create_index("status")
    await db.logs.create_index("timestamp")
    await db.notifications.create_index("sent_at")
    
    # Seed admin if not exists
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@taxi.local")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    
    existing_admin = await db.users.find_one({"email": admin_email, "role": "admin"})
    if not existing_admin:
        admin = {
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "phone": "+70000000000",
            "role": "admin",
            "name": "Администратор",
            "is_activated": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin)
        logger.info(f"Admin user created: {admin_email}")
    
    # Initialize default settings if not exists
    settings = await db.settings.find_one({"id": "main"})
    if not settings:
        default_settings = {
            "id": "main",
            "maintenance_mode": False,
            "maintenance_text": "Ведутся технические работы",
            "terms_text": "Условия использования сервиса такси. Пользуясь сервисом, вы соглашаетесь с данными условиями.",
            "privacy_text": "Политика конфиденциальности. Мы обрабатываем ваши персональные данные в соответствии с законодательством.",
            "customer_rules_text": "Правила для пассажиров:\n1. Будьте вежливы с водителем\n2. Указывайте точный адрес\n3. Будьте готовы к приезду машины",
            "driver_rules_text": "Правила для водителей:\n1. Соблюдайте ПДД\n2. Будьте вежливы с пассажирами\n3. Поддерживайте чистоту в автомобиле",
            "active_map_provider": "yandex"
        }
        await db.settings.insert_one(default_settings)
    
    # Write test credentials
    os.makedirs("/app/memory", exist_ok=True)
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write(f"# Test Credentials\n\n")
        f.write(f"## Admin\n- Email: {admin_email}\n- Password: {admin_password}\n\n")
        f.write(f"## Test Customer\n- Phone: +79001234567\n- SMS Code: 1234\n\n")
        f.write(f"## Test Driver\n- Phone: +79007654321\n- SMS Code: 1234\n- (needs admin activation)\n")
    
    logger.info("Taxi WebToApp API started")

@app.on_event("shutdown")
async def shutdown():
    client.close()
