from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, WebSocket, WebSocketDisconnect, UploadFile, File, Form
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

from fastapi.staticfiles import StaticFiles
import shutil

ROOT_DIR = Path(__file__).parent
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get("JWT_SECRET", secrets.token_hex(32))
JWT_ALGORITHM = "HS256"

# Create the main app
app = FastAPI(title="Taxi WebToApp API")

# Serve uploaded files
app.mount("/api/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

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

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    avatar: Optional[str] = None

class LocationUpdate(BaseModel):
    lat: float
    lng: float

class CustomerCreate(BaseModel):
    phone: str
    device_id: str
    agreed_terms: bool = False
    agreed_privacy: bool = False

class DriverCreate(BaseModel):
    phone: str
    device_id: str
    name: str
    car_model: str
    car_number: str
    agreed_terms: bool = False
    agreed_privacy: bool = False

class VerifyCode(BaseModel):
    phone: str
    code: str
    role: str
    device_id: str

class SetPin(BaseModel):
    pin: str

class LoginPin(BaseModel):
    phone: str
    pin: str
    role: str
    device_id: str

class ResetPinRequest(BaseModel):
    phone: str
    role: str
    device_id: str

class ResetPinVerify(BaseModel):
    phone: str
    code: str
    role: str
    device_id: str
    new_pin: str

class DeviceBlock(BaseModel):
    device_id: str
    reason: Optional[str] = None

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
    app_name: Optional[str] = None
    app_icon_url: Optional[str] = None
    sms_ru_api_key: Optional[str] = None
    onesignal_app_id: Optional[str] = None
    onesignal_api_key: Optional[str] = None
    onesignal_android_app_id: Optional[str] = None
    onesignal_android_api_key: Optional[str] = None
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
    test_mode: Optional[bool] = None
    system_logging: Optional[bool] = None
    log_level: Optional[str] = None
    custom_pin_url: Optional[str] = None
    eta_options: Optional[str] = None
    map_bg_color: Optional[str] = None
    map_grid_color: Optional[str] = None
    map_bg_image_url: Optional[str] = None
    map_bg_size: Optional[str] = None
    map_bg_position: Optional[str] = None
    map_bg_repeat: Optional[str] = None
    map_enabled: Optional[bool] = None
    # PWA
    pwa_enabled: Optional[bool] = None
    pwa_short_name: Optional[str] = None
    pwa_prompt_text: Optional[str] = None
    pwa_icon_192_url: Optional[str] = None
    pwa_icon_512_url: Optional[str] = None
    # Call verification (sms.ru callcheck)
    call_verify_enabled: Optional[bool] = None
    call_verify_title: Optional[str] = None
    call_verify_instruction: Optional[str] = None
    call_verify_timeout: Optional[int] = None
    call_verify_poll_interval: Optional[int] = None
    call_verify_rate_limit: Optional[int] = None
    # Notification channel routing
    notification_channel: Optional[str] = None  # 'push' | 'sms' | 'both'
    sms_events: Optional[List[str]] = None      # event keys to send via SMS

class AdminLogin(BaseModel):
    email: str
    password: str

class MessageTemplate(BaseModel):
    key: str
    text: str

class AdminCredentialsUpdate(BaseModel):
    current_password: str
    new_email: Optional[str] = None
    new_password: Optional[str] = None

class FabButton(BaseModel):
    role: str  # 'customer' | 'driver' | 'both'
    label: str
    icon_svg: Optional[str] = ""
    title: Optional[str] = ""
    content_html: Optional[str] = ""
    order: Optional[int] = 0
    is_active: Optional[bool] = True

class FabButtonUpdate(BaseModel):
    role: Optional[str] = None
    label: Optional[str] = None
    icon_svg: Optional[str] = None
    title: Optional[str] = None
    content_html: Optional[str] = None
    order: Optional[int] = None
    is_active: Optional[bool] = None

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
        raise HTTPException(status_code=401, detail="Не авторизован")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="Пользователь не найден")
        user.pop("_id", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Сессия истекла")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Неверный токен")

async def get_admin_user(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Требуется доступ администратора")
    return user

async def log_action(action: str, user_id: str = None, details: dict = None):
    # Translate action to Russian
    action_translations = {
        "customer_registered": "Регистрация пассажира",
        "driver_registered": "Регистрация водителя",
        "user_login": "Вход в систему",
        "admin_login": "Вход администратора",
        "sms_sent": "Отправлена СМС",
        "order_created": "Создан заказ",
        "order_accepted": "Заказ принят",
        "order_completed": "Заказ завершён",
        "order_cancelled": "Заказ отменён",
        "order_problem": "Проблема с заказом",
        "driver_status_change": "Изменение статуса водителя",
        "driver_activated": "Водитель активирован",
        "driver_deactivated": "Водитель деактивирован",
        "user_updated": "Данные пользователя обновлены",
        "settings_updated": "Настройки обновлены",
        "notification_sent": "Уведомление отправлено",
        "profile_updated": "Профиль обновлён",
        "location_updated": "Местоположение обновлено"
    }
    
    action_ru = action_translations.get(action, action)
    
    log_entry = {
        "id": str(uuid.uuid4()),
        "action": action,
        "action_ru": action_ru,
        "user_id": user_id,
        "details": details or {},
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.logs.insert_one(log_entry)

async def system_log(level: str, source: str, message: str, details: dict = None):
    """Write system-level log with level: error, warning, info, debug"""
    # Check if logging is enabled
    settings = await db.settings.find_one({"id": "main"})
    if settings and not settings.get("system_logging", True):
        return
    
    # Check log level threshold
    levels = {"debug": 0, "info": 1, "warning": 2, "error": 3}
    min_level = settings.get("log_level", "info") if settings else "info"
    if levels.get(level, 1) < levels.get(min_level, 1):
        return
    
    entry = {
        "id": str(uuid.uuid4()),
        "level": level,
        "source": source,
        "message": message,
        "details": details or {},
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.system_logs.insert_one(entry)

def get_client_ip(request: Optional[Request]) -> Optional[str]:
    """Extract client IP from Request, honouring proxy headers."""
    if not request:
        return None
    try:
        fwd = request.headers.get("x-forwarded-for") or request.headers.get("x-real-ip") or ""
        if fwd:
            return fwd.split(",")[0].strip()
        return request.client.host if request.client else None
    except Exception:
        return None

async def send_sms_ru(phone: str, message: str, ip: Optional[str] = None) -> tuple[bool, str]:
    """Send SMS via SMS.ru. Returns (success, info).
    
    ip: Optional client IP address — recommended by SMS.ru for anti-fraud protection.
    """
    settings = await db.settings.find_one({"id": "main"})
    api_key = (settings or {}).get("sms_ru_api_key", "")
    if not api_key or not phone:
        return False, "no_api_key_or_phone"
    try:
        import requests as http_requests
        to = phone.lstrip("+").strip()
        params = {"api_id": api_key, "to": to, "msg": message, "json": 1}
        if ip:
            params["ip"] = ip
        resp = http_requests.get("https://sms.ru/sms/send", params=params, timeout=10)
        data = resp.json() if resp.content else {}
        if data.get("status") == "OK":
            return True, str(data)
        return False, str(data)
    except Exception as e:
        return False, str(e)


async def send_notification(user_id: str, title: str, message: str, notification_type: str = "push", event: Optional[str] = None, ip: Optional[str] = None):
    """Send notification — routes via push (OneSignal) or SMS (SMS.ru) per settings.
    
    event: optional key (e.g. 'order_accepted', 'order_created'). When provided and the
    setting `notification_channel` is 'sms' or `sms_events` contains this event,
    the notification is sent over SMS instead of (or in addition to) push.
    """
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": notification_type,
        "event": event,
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending"
    }
    
    settings = await db.settings.find_one({"id": "main"})
    onesignal_app_id = (settings or {}).get("onesignal_app_id", "")
    onesignal_api_key = (settings or {}).get("onesignal_api_key", "")
    channel_pref = (settings or {}).get("notification_channel", "push")
    sms_events = set((settings or {}).get("sms_events") or [])
    
    # Decide route
    send_via_sms = False
    send_via_push = False
    if notification_type == "push":
        if channel_pref == "sms":
            send_via_sms = True
        elif channel_pref == "both":
            send_via_sms = True
            send_via_push = True
        elif channel_pref == "push":
            # Per-event override: even in push mode, specific events can go via SMS
            if event and event in sms_events:
                send_via_sms = True
            else:
                send_via_push = True
        else:
            send_via_push = True
    
    # ===== SMS route =====
    if send_via_sms:
        try:
            user = await db.users.find_one({"id": user_id}, {"_id": 0, "phone": 1})
            phone = (user or {}).get("phone")
            if not phone:
                notification["status"] = "no_phone"
                await system_log("info", "sms", f"SMS пропущен (нет номера): {title}", {"user_id": user_id[:8]})
            else:
                sms_text = f"{title}: {message}" if title and title not in message else message
                ok, info = await send_sms_ru(phone, sms_text, ip=ip)
                if ok:
                    notification["status"] = "sent_sms"
                    await system_log("info", "sms", f"SMS отправлен: {title}", {"user_id": user_id[:8], "phone": phone[-4:]})
                else:
                    notification["status"] = "sms_failed"
                    notification["error"] = info[:300]
                    await system_log("warning", "sms", f"SMS не отправлен: {info[:120]}", {"user_id": user_id[:8]})
        except Exception as e:
            notification["status"] = "sms_error"
            await system_log("error", "sms", f"Ошибка SMS: {str(e)}", {"user_id": user_id[:8]})
    
    # ===== Push route =====
    if send_via_push and onesignal_app_id and onesignal_api_key:
        try:
            # Build list of OneSignal apps to send to: primary (web) + optional Android
            android_app_id = (settings or {}).get("onesignal_android_app_id", "")
            android_api_key = (settings or {}).get("onesignal_android_api_key", "")
            os_apps = [(onesignal_app_id, onesignal_api_key, "web")]
            if android_app_id and android_api_key:
                os_apps.append((android_app_id, android_api_key, "android"))
            
            import requests as http_requests
            all_attempts = []
            any_sent_id = None
            last_error_overall = None
            for app_id_to_use, api_key_to_use, app_label in os_apps:
                is_v2_key = api_key_to_use.startswith("os_v2_")
                base_url = "https://api.onesignal.com" if is_v2_key else "https://onesignal.com/api/v1"
                auth_header = f"Key {api_key_to_use}" if is_v2_key else f"Basic {api_key_to_use}"
                headers = {
                    "Content-Type": "application/json; charset=utf-8",
                    "Authorization": auth_header
                }
                base_payload = {
                    "app_id": app_id_to_use,
                    "target_channel": "push",
                    "headings": {"en": title, "ru": title},
                    "contents": {"en": message, "ru": message},
                    "include_aliases": {"external_id": [user_id]},
                    "filters": [{"field": "tag", "key": "user_id", "relation": "=", "value": user_id}],
                }
                attempts = [
                    {**base_payload, "filters": None},
                    {**{k: v for k, v in base_payload.items() if k != "include_aliases"}, "filters": base_payload["filters"]},
                ]
                sent_id = None
                last_error = None
                attempt_logs = []
                for idx, body in enumerate(attempts):
                    body = {k: v for k, v in body.items() if v is not None}
                    method = "alias_external_id" if idx == 0 else "tag_user_id"
                    attempt_info = {"app": app_label, "method": method, "request": body}
                    try:
                        resp = http_requests.post(f"{base_url}/notifications", json=body, headers=headers, timeout=10)
                        result = resp.json() if resp.content else {}
                        attempt_info["http_status"] = resp.status_code
                        attempt_info["response"] = result
                    except Exception as e:
                        last_error = str(e)
                        attempt_info["exception"] = str(e)
                        attempt_logs.append(attempt_info)
                        continue
                    attempt_logs.append(attempt_info)
                    if result.get("id"):
                        sent_id = result["id"]
                        break
                    last_error = result
                all_attempts.extend(attempt_logs)
                if sent_id and not any_sent_id:
                    any_sent_id = sent_id
                if not sent_id:
                    last_error_overall = last_error
            # Final outcome (across web + android apps)
            if any_sent_id:
                notification["status"] = "sent"
                notification["onesignal_id"] = any_sent_id
                await system_log("info", "push", f"Push отправлен: {title}", {
                    "user_id": user_id,
                    "onesignal_id": any_sent_id,
                    "title": title,
                    "channel": "push",
                    "attempts": all_attempts,
                })
            else:
                err_str = str(last_error_overall).lower()
                if "not subscribed" in err_str or "invalid_aliases" in err_str or "no subscribers" in err_str:
                    notification["status"] = "no_subscription"
                    await system_log("info", "push", f"Push пропущен (не подписан): {title}", {
                        "user_id": user_id,
                        "title": title,
                        "channel": "push",
                        "reason": "no_active_subscription",
                        "attempts": all_attempts,
                    })
                else:
                    notification["status"] = "failed"
                    notification["error"] = str(last_error_overall)[:500]
                    await system_log("warning", "push", f"Push не отправлен: {last_error_overall}", {
                        "user_id": user_id,
                        "title": title,
                        "channel": "push",
                        "attempts": all_attempts,
                    })
        except Exception as e:
            notification["status"] = "error"
            await system_log("error", "push", f"Ошибка OneSignal: {str(e)}", {"user_id": user_id, "exception_type": type(e).__name__})
    
    await db.notifications.insert_one(notification)
    await log_action("notification_sent", user_id, {"title": title, "type": notification_type})
    return notification

async def send_email(to_email: str, subject: str, body: str, html_body: str = None):
    """Send email via SMTP in background thread"""
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    import asyncio
    
    settings = await db.settings.find_one({"id": "main"})
    if not settings:
        return False
    
    smtp_host = settings.get("smtp_host", "")
    smtp_port = settings.get("smtp_port", 465)
    smtp_user = settings.get("smtp_user", "")
    smtp_password = settings.get("smtp_password", "")
    smtp_from = settings.get("smtp_from_email", smtp_user)
    
    if not smtp_host or not smtp_user or not smtp_password:
        await system_log("warning", "email", f"SMTP не настроен, письмо не отправлено: {subject}")
        return False
    
    def _send():
        try:
            msg = MIMEMultipart("alternative")
            msg["From"] = smtp_from
            msg["To"] = to_email
            msg["Subject"] = subject
            
            msg.attach(MIMEText(body, "plain", "utf-8"))
            if html_body:
                msg.attach(MIMEText(html_body, "html", "utf-8"))
            
            if int(smtp_port) == 465:
                server = smtplib.SMTP_SSL(smtp_host, int(smtp_port), timeout=10)
            else:
                server = smtplib.SMTP(smtp_host, int(smtp_port), timeout=10)
                server.starttls()
            
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_from, to_email, msg.as_string())
            server.quit()
            return True
        except Exception as e:
            return str(e)
    
    try:
        loop = asyncio.get_event_loop()
        result = await asyncio.wait_for(loop.run_in_executor(None, _send), timeout=15)
        
        if result is True:
            await system_log("info", "email", f"Email отправлен: {subject}", {"to": to_email})
            return True
        else:
            await system_log("error", "email", f"Ошибка SMTP: {result}", {"to": to_email, "subject": subject})
            return False
    except asyncio.TimeoutError:
        await system_log("error", "email", "SMTP таймаут (15 сек)", {"to": to_email, "subject": subject})
        return False
    except Exception as e:
        await system_log("error", "email", f"Ошибка: {str(e)}", {"to": to_email, "subject": subject})
        return False

async def send_admin_email(subject: str, body: str):
    """Send email notification to admin"""
    settings = await db.settings.find_one({"id": "main"})
    admin_email = settings.get("admin_email") if settings else None
    
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": "admin",
        "title": subject,
        "message": body,
        "type": "email",
        "to_email": admin_email,
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending"
    }
    
    sent = False
    if admin_email:
        html = f"""
        <div style="font-family:Inter,Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px">
            <h2 style="color:#0f172a;margin-bottom:10px">{subject}</h2>
            <div style="color:#475569;line-height:1.6;white-space:pre-line">{body}</div>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
            <p style="color:#94a3b8;font-size:12px">Такси «Рядом» — Уведомление администратору</p>
        </div>
        """
        sent = await send_email(admin_email, subject, body, html)
        notification["status"] = "sent" if sent else "smtp_error"
    else:
        notification["status"] = "no_email_configured"
    
    await db.notifications.insert_one(notification)
    await log_action("admin_email_sent", None, {"subject": subject, "sent": sent})
    return notification

async def check_device_blocked(device_id: str) -> dict:
    """Check if device is blocked"""
    blocked = await db.blocked_devices.find_one({"device_id": device_id, "is_blocked": True})
    return blocked

async def block_device(device_id: str, reason: str = None):
    """Block a device"""
    await db.blocked_devices.update_one(
        {"device_id": device_id},
        {"$set": {
            "device_id": device_id,
            "is_blocked": True,
            "reason": reason,
            "blocked_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    await log_action("device_blocked", None, {"device_id": device_id, "reason": reason})

async def get_device_registration_count(device_id: str) -> int:
    """Get number of registrations from this device"""
    count = await db.users.count_documents({"device_id": device_id})
    return count

# ============ AUTH ROUTES ============

@auth_router.post("/send-code")
async def send_verification_code(data: dict, request: Request):
    client_ip = (request.headers.get("x-forwarded-for") or request.headers.get("x-real-ip") or (request.client.host if request.client else "")).split(",")[0].strip()
    phone = data.get("phone")
    role = data.get("role")
    device_id = data.get("device_id")
    
    if not phone or not role:
        raise HTTPException(status_code=400, detail="Укажите телефон и роль")
    
    if not device_id:
        raise HTTPException(status_code=400, detail="Требуется идентификатор устройства")
    
    # Check if device is blocked
    blocked = await check_device_blocked(device_id)
    if blocked:
        raise HTTPException(status_code=403, detail=f"DEVICE_BLOCKED:{blocked.get('reason', 'Устройство заблокировано')}")
    
    # Generate 4-digit code
    code = str(secrets.randbelow(9000) + 1000)  # Random 4-digit code
    
    # Store code in DB
    await db.verification_codes.delete_many({"phone": phone})
    await db.verification_codes.insert_one({
        "phone": phone,
        "code": code,
        "role": role,
        "device_id": device_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    })
    
    # Try to send via SMS.ru if key is configured
    sms_sent = False
    settings = await db.settings.find_one({"id": "main"})
    sms_api_key = settings.get("sms_ru_api_key", "") if settings else ""
    
    if sms_api_key:
        try:
            import requests as http_requests
            # Normalize phone: remove +, spaces
            clean_phone = phone.replace("+", "").replace(" ", "").replace("-", "")
            params = {
                "api_id": sms_api_key,
                "to": clean_phone,
                "msg": f"Код подтверждения: {code}",
                "json": 1
            }
            if client_ip:
                params["ip"] = client_ip
            resp = http_requests.get("https://sms.ru/sms/send", params=params, timeout=10)
            result = resp.json()
            if result.get("status") == "OK":
                sms_sent = True
                await system_log("info", "sms", f"SMS отправлен на {phone}", {"status": "OK", "balance": result.get("balance")})
            else:
                await system_log("warning", "sms", f"SMS не отправлен: {result.get('status_text', 'unknown')}", {"phone": phone, "response": result})
        except Exception as e:
            await system_log("error", "sms", f"Ошибка отправки SMS: {str(e)}", {"phone": phone})
    
    if not sms_sent:
        # Fallback: log code in notifications (mock push)
        await send_notification(
            phone, 
            "Код подтверждения", 
            f"Ваш код для входа: {code}", 
            "sms" if sms_api_key else "push"
        )
    
    await log_action("verification_code_sent", None, {"phone": phone, "device_id": device_id[:8], "sms_sent": sms_sent})
    
    return {"success": True, "message": "Code sent via SMS" if sms_sent else "Code sent via push notification"}

@auth_router.post("/verify-code")
async def verify_code(data: VerifyCode):
    # Check if device is blocked
    blocked = await check_device_blocked(data.device_id)
    if blocked:
        raise HTTPException(status_code=403, detail=f"DEVICE_BLOCKED:{blocked.get('reason', 'Устройство заблокировано')}")
    
    # Check if test mode is enabled before accepting test code
    settings = await db.settings.find_one({"id": "main"})
    is_test_mode = settings.get("test_mode", True) if settings else True
    is_test_code = data.code == "1234" and is_test_mode
    
    if not is_test_code:
        verification = await db.verification_codes.find_one({
            "phone": data.phone,
            "code": data.code,
            "role": data.role
        })
        
        if not verification:
            raise HTTPException(status_code=400, detail="Неверный код")
        
        # Check if code expired
        expires_at = datetime.fromisoformat(verification["expires_at"])
        if datetime.now(timezone.utc) > expires_at:
            raise HTTPException(status_code=400, detail="Срок действия кода истёк")
    
    # Find or check user
    user = await db.users.find_one({"phone": data.phone, "role": data.role})
    
    if data.role == "customer":
        if not user:
            # Check registration count from this device
            reg_count = await get_device_registration_count(data.device_id)
            if reg_count >= 5:
                # Block device after too many registrations
                await block_device(data.device_id, "Множественные регистрации с одного устройства")
                raise HTTPException(status_code=403, detail="DEVICE_BLOCKED:Множественные регистрации с одного устройства")
            
            # Create new customer
            user = {
                "id": str(uuid.uuid4()),
                "phone": data.phone,
                "device_id": data.device_id,
                "role": "customer",
                "name": None,
                "avatar": None,
                "is_activated": True,
                "total_orders": 0,
                "cancelled_orders": 0,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(user)
            await log_action("customer_registered", user["id"], {"phone": data.phone, "device_id": data.device_id[:8]})
            
            # Send email to admin about new registration
            await send_admin_email(
                "Новая регистрация пассажира",
                f"Новый пассажир зарегистрирован:\n\nТелефон: {data.phone}\nID устройства: {data.device_id[:16]}...\nВремя: {datetime.now(timezone.utc).isoformat()}"
            )
        else:
            # Check if user's device matches
            if user.get("device_id") and user.get("device_id") != data.device_id:
                # Different device trying to login - potential issue
                await log_action("login_different_device", user["id"], {
                    "original_device": user.get("device_id", "")[:8],
                    "new_device": data.device_id[:8]
                })
            # Update device_id on login
            await db.users.update_one({"id": user["id"]}, {"$set": {"device_id": data.device_id}})
            
    elif data.role == "driver":
        if not user:
            raise HTTPException(status_code=400, detail="Водитель не зарегистрирован")
        if not user.get("is_activated", False):
            raise HTTPException(status_code=403, detail="AWAITING_ACTIVATION")
        # Update device_id on login
        await db.users.update_one({"id": user["id"]}, {"$set": {"device_id": data.device_id}})
    
    # Delete used code
    await db.verification_codes.delete_many({"phone": data.phone})
    
    # Create token
    token = create_access_token(user["id"], user["role"])
    user.pop("_id", None)
    user.pop("pin_hash", None)
    user.pop("password_hash", None)
    
    has_pin = user.get("has_pin", False)
    
    await log_action("user_login", user["id"], {"phone": data.phone, "role": data.role, "device_id": data.device_id[:8]})
    
    return {"token": token, "user": user, "has_pin": has_pin}

# ============ CALL VERIFICATION (SMS.RU CALLCHECK) ============

@auth_router.post("/callcheck/start")
async def callcheck_start(data: dict):
    phone = data.get("phone")
    role = data.get("role")
    device_id = data.get("device_id")
    if not phone or not role or not device_id:
        raise HTTPException(status_code=400, detail="Укажите телефон, роль и устройство")

    blocked = await check_device_blocked(device_id)
    if blocked:
        raise HTTPException(status_code=403, detail=f"DEVICE_BLOCKED:{blocked.get('reason', 'Устройство заблокировано')}")

    settings = await db.settings.find_one({"id": "main"}) or {}
    api_key = settings.get("sms_ru_api_key", "")
    enabled = settings.get("call_verify_enabled", False)
    existing_user = await db.users.find_one({"phone": phone, "role": role})

    # Call verification is used ONLY for new customer registrations, when enabled
    if not enabled or not api_key or existing_user or role != "customer":
        return {"method": "sms"}

    now = datetime.now(timezone.utc)
    rate_limit = int(settings.get("call_verify_rate_limit") or 60)
    last = await db.callcheck_requests.find_one({"phone": phone}, sort=[("created_at", -1)])
    if last and last.get("created_at"):
        elapsed = (now - datetime.fromisoformat(last["created_at"])).total_seconds()
        if elapsed < rate_limit:
            raise HTTPException(status_code=429, detail=f"RATE_LIMIT:{int(rate_limit - elapsed)}")

    hour_ago = (now - timedelta(hours=1)).isoformat()
    hour_count = await db.callcheck_requests.count_documents({"device_id": device_id, "created_at": {"$gte": hour_ago}})
    if hour_count >= 5:
        raise HTTPException(status_code=429, detail="RATE_LIMIT_HOUR")

    try:
        import requests as http_requests
        resp = http_requests.get("https://sms.ru/callcheck/add", params={"api_id": api_key, "phone": phone.lstrip("+"), "json": 1}, timeout=10)
        result = resp.json() if resp.content else {}
    except Exception as e:
        await system_log("error", "callcheck", f"Ошибка callcheck/add: {str(e)}", {"phone": phone[-4:]})
        return {"method": "sms"}

    if result.get("status") != "OK":
        await system_log("warning", "callcheck", f"callcheck/add отклонён: {result.get('status_text', 'unknown')}", {"phone": phone[-4:]})
        return {"method": "sms"}

    timeout_sec = int(settings.get("call_verify_timeout") or 300)
    verify_id = str(uuid.uuid4())
    await db.callcheck_requests.insert_one({
        "id": verify_id,
        "check_id": result.get("check_id"),
        "phone": phone,
        "role": role,
        "device_id": device_id,
        "status": "waiting",
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(seconds=timeout_sec)).isoformat()
    })
    await system_log("info", "callcheck", "Верификация звонком запущена", {"phone": phone[-4:], "check_id": result.get("check_id")})
    await log_action("callcheck_started", None, {"phone": phone, "device_id": device_id[:8]})

    return {
        "method": "call",
        "verify_id": verify_id,
        "call_phone": result.get("call_phone", ""),
        "call_phone_pretty": result.get("call_phone_pretty", ""),
        "timeout": timeout_sec,
        "poll_interval": int(settings.get("call_verify_poll_interval") or 3),
        "title": settings.get("call_verify_title") or "Подтверждение номера телефона",
        "instruction": settings.get("call_verify_instruction") or "Вам необходимо позвонить по номеру ниже для подтверждения. Звонок бесплатный. После звонка подтверждение произойдёт автоматически."
    }

@auth_router.post("/callcheck/status")
async def callcheck_status(data: dict):
    verify_id = data.get("verify_id")
    device_id = data.get("device_id")
    if not verify_id:
        raise HTTPException(status_code=400, detail="Не указан идентификатор проверки")

    rec = await db.callcheck_requests.find_one({"id": verify_id}, {"_id": 0})
    if not rec or (device_id and rec.get("device_id") != device_id):
        raise HTTPException(status_code=404, detail="Проверка не найдена")

    if rec.get("status") == "expired":
        return {"status": "expired"}
    if rec.get("status") == "confirmed":
        # Re-issue confirmation to the same device (lost response / parallel confirm)
        user = await db.users.find_one({"phone": rec["phone"], "role": rec["role"]})
        if user:
            token = create_access_token(user["id"], user["role"])
            user.pop("_id", None)
            user.pop("pin_hash", None)
            user.pop("password_hash", None)
            return {"status": "confirmed", "token": token, "user": user, "has_pin": user.get("has_pin", False)}
        return {"status": "expired"}

    now = datetime.now(timezone.utc)
    if now > datetime.fromisoformat(rec["expires_at"]):
        await db.callcheck_requests.update_one({"id": verify_id}, {"$set": {"status": "expired"}})
        return {"status": "expired"}

    settings = await db.settings.find_one({"id": "main"}) or {}
    api_key = settings.get("sms_ru_api_key", "")
    # Test-mode shortcut (like code 1234): allows confirming without a real call
    if settings.get("test_mode", True) and data.get("test_confirm"):
        check_status = "401"
    else:
        try:
            import requests as http_requests
            resp = http_requests.get("https://sms.ru/callcheck/status", params={"api_id": api_key, "check_id": rec["check_id"], "json": 1}, timeout=10)
            result = resp.json() if resp.content else {}
        except Exception:
            return {"status": "waiting"}
        check_status = str(result.get("check_status", "400"))
    if check_status == "402":
        await db.callcheck_requests.update_one({"id": verify_id}, {"$set": {"status": "expired"}})
        return {"status": "expired"}
    if check_status != "401":
        return {"status": "waiting"}

    # Confirmed — register (or login) the customer
    await db.callcheck_requests.update_one({"id": verify_id}, {"$set": {"status": "confirmed"}})
    phone, role = rec["phone"], rec["role"]
    user = await db.users.find_one({"phone": phone, "role": role})
    if not user:
        reg_count = await get_device_registration_count(rec["device_id"])
        if reg_count >= 5:
            await block_device(rec["device_id"], "Множественные регистрации с одного устройства")
            raise HTTPException(status_code=403, detail="DEVICE_BLOCKED:Множественные регистрации с одного устройства")
        user = {
            "id": str(uuid.uuid4()),
            "phone": phone,
            "device_id": rec["device_id"],
            "role": "customer",
            "name": None,
            "avatar": None,
            "is_activated": True,
            "total_orders": 0,
            "cancelled_orders": 0,
            "created_at": now.isoformat()
        }
        await db.users.insert_one(user)
        await log_action("customer_registered", user["id"], {"phone": phone, "method": "callcheck"})
        await send_admin_email(
            "Новая регистрация пассажира",
            f"Новый пассажир зарегистрирован (подтверждение звонком):\n\nТелефон: {phone}\nВремя: {now.isoformat()}"
        )
    else:
        await db.users.update_one({"id": user["id"]}, {"$set": {"device_id": rec["device_id"]}})

    token = create_access_token(user["id"], user["role"])
    user.pop("_id", None)
    user.pop("pin_hash", None)
    user.pop("password_hash", None)
    await log_action("user_login", user["id"], {"phone": phone, "role": role, "method": "callcheck"})
    await system_log("info", "callcheck", "Номер подтверждён звонком", {"phone": phone[-4:]})
    return {"status": "confirmed", "token": token, "user": user, "has_pin": user.get("has_pin", False)}

@auth_router.post("/set-pin")
async def set_user_pin(data: SetPin, user: dict = Depends(get_current_user)):
    """Set or update user's PIN code"""
    if not data.pin or len(data.pin) != 4 or not data.pin.isdigit():
        raise HTTPException(status_code=400, detail="PIN-код должен состоять из 4 цифр")
    
    pin_hash = hash_password(data.pin)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"pin_hash": pin_hash, "has_pin": True}}
    )
    await log_action("pin_set", user["id"], {"phone": user["phone"]})
    return {"success": True}

@auth_router.post("/login-pin")
async def login_with_pin(data: LoginPin):
    """Login with phone + PIN (no OTP needed)"""
    # Check device blocked
    blocked = await check_device_blocked(data.device_id)
    if blocked:
        raise HTTPException(status_code=403, detail=f"DEVICE_BLOCKED:{blocked.get('reason', 'Устройство заблокировано')}")
    
    user = await db.users.find_one({"phone": data.phone, "role": data.role})
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    if not user.get("pin_hash"):
        raise HTTPException(status_code=400, detail="PIN-код не установлен")
    
    if not verify_password(data.pin, user["pin_hash"]):
        # Track failed attempts
        attempts = user.get("pin_attempts", 0) + 1
        await db.users.update_one({"id": user["id"]}, {"$set": {"pin_attempts": attempts}})
        
        if attempts >= 5:
            # Lock PIN after 5 failed attempts, require OTP reset
            await db.users.update_one({"id": user["id"]}, {"$set": {"pin_locked": True}})
            await log_action("pin_locked", user["id"], {"reason": "Too many failed attempts"})
            raise HTTPException(status_code=403, detail="PIN_LOCKED")
        
        raise HTTPException(status_code=401, detail=f"WRONG_PIN:{5 - attempts}")
    
    # Check driver activation
    if data.role == "driver" and not user.get("is_activated", False):
        raise HTTPException(status_code=403, detail="AWAITING_ACTIVATION")
    
    # Reset pin attempts on successful login
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"pin_attempts": 0, "device_id": data.device_id}}
    )
    
    token = create_access_token(user["id"], user["role"])
    user.pop("_id", None)
    user.pop("pin_hash", None)
    user.pop("password_hash", None)
    
    await log_action("user_login", user["id"], {"phone": data.phone, "role": data.role, "method": "pin"})
    
    return {"token": token, "user": user}

@auth_router.post("/reset-pin-request")
async def reset_pin_request(data: ResetPinRequest, request: Request):
    """Send OTP code for PIN reset"""
    client_ip = (request.headers.get("x-forwarded-for") or request.headers.get("x-real-ip") or (request.client.host if request.client else "")).split(",")[0].strip()
    blocked = await check_device_blocked(data.device_id)
    if blocked:
        raise HTTPException(status_code=403, detail=f"DEVICE_BLOCKED:{blocked.get('reason', 'Устройство заблокировано')}")
    
    user = await db.users.find_one({"phone": data.phone, "role": data.role})
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    code = str(secrets.randbelow(9000) + 1000)
    
    await db.verification_codes.delete_many({"phone": data.phone})
    await db.verification_codes.insert_one({
        "phone": data.phone,
        "code": code,
        "role": data.role,
        "device_id": data.device_id,
        "purpose": "pin_reset",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    })
    
    # Try SMS.ru
    settings = await db.settings.find_one({"id": "main"})
    sms_api_key = settings.get("sms_ru_api_key", "") if settings else ""
    sms_sent = False
    if sms_api_key:
        try:
            import requests as http_requests
            clean_phone = data.phone.replace("+", "").replace(" ", "").replace("-", "")
            params = {"api_id": sms_api_key, "to": clean_phone, "msg": f"Код сброса PIN: {code}", "json": 1}
            if client_ip:
                params["ip"] = client_ip
            resp = http_requests.get("https://sms.ru/sms/send", params=params, timeout=10)
            if resp.json().get("status") == "OK":
                sms_sent = True
        except Exception:
            pass
    
    if not sms_sent:
        await send_notification(user["id"], "Сброс PIN-кода", f"Ваш код для сброса PIN: {code}", "push")
    
    await log_action("pin_reset_requested", user["id"], {"phone": data.phone, "sms_sent": sms_sent})
    
    return {"success": True, "message": "Code sent for PIN reset"}

@auth_router.post("/reset-pin-verify")
async def reset_pin_verify(data: ResetPinVerify):
    """Verify OTP and set new PIN"""
    blocked = await check_device_blocked(data.device_id)
    if blocked:
        raise HTTPException(status_code=403, detail=f"DEVICE_BLOCKED:{blocked.get('reason', 'Устройство заблокировано')}")
    
    # Check if test mode is enabled before accepting test code
    settings = await db.settings.find_one({"id": "main"})
    is_test_mode = settings.get("test_mode", True) if settings else True
    is_test_code = data.code == "1234" and is_test_mode
    
    if not is_test_code:
        verification = await db.verification_codes.find_one({
            "phone": data.phone, "code": data.code, "role": data.role
        })
        if not verification:
            raise HTTPException(status_code=400, detail="Неверный код")
        
        expires_at = datetime.fromisoformat(verification["expires_at"])
        if datetime.now(timezone.utc) > expires_at:
            raise HTTPException(status_code=400, detail="Срок действия кода истёк")
    
    if not data.new_pin or len(data.new_pin) != 4 or not data.new_pin.isdigit():
        raise HTTPException(status_code=400, detail="PIN-код должен состоять из 4 цифр")
    
    user = await db.users.find_one({"phone": data.phone, "role": data.role})
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    pin_hash = hash_password(data.new_pin)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"pin_hash": pin_hash, "has_pin": True, "pin_locked": False, "pin_attempts": 0, "device_id": data.device_id}}
    )
    
    await db.verification_codes.delete_many({"phone": data.phone})
    
    # Auto-login after PIN reset
    token = create_access_token(user["id"], user["role"])
    user.pop("_id", None)
    user.pop("pin_hash", None)
    user.pop("password_hash", None)
    
    await log_action("pin_reset_complete", user["id"], {"phone": data.phone})
    
    return {"token": token, "user": user}

@auth_router.get("/check-pin/{phone}/{role}")
async def check_has_pin(phone: str, role: str):
    """Check if user has PIN set"""
    user = await db.users.find_one({"phone": phone, "role": role})
    if not user:
        return {"exists": False, "has_pin": False, "pin_locked": False}
    
    return {
        "exists": True,
        "has_pin": user.get("has_pin", False),
        "pin_locked": user.get("pin_locked", False),
        "is_activated": user.get("is_activated", True)
    }

@auth_router.post("/register-driver")
async def register_driver(data: DriverCreate):
    if not data.agreed_terms or not data.agreed_privacy:
        raise HTTPException(status_code=400, detail="Необходимо принять условия и политику конфиденциальности")
    
    if not data.device_id:
        raise HTTPException(status_code=400, detail="Требуется идентификатор устройства")
    
    # Check if device is blocked
    blocked = await check_device_blocked(data.device_id)
    if blocked:
        raise HTTPException(status_code=403, detail=f"DEVICE_BLOCKED:{blocked.get('reason', 'Устройство заблокировано')}")
    
    # Check registration count from this device
    reg_count = await get_device_registration_count(data.device_id)
    if reg_count >= 5:
        await block_device(data.device_id, "Множественные регистрации с одного устройства")
        raise HTTPException(status_code=403, detail="DEVICE_BLOCKED:Множественные регистрации с одного устройства")
    
    # Check if driver already exists
    existing = await db.users.find_one({"phone": data.phone, "role": "driver"})
    if existing:
        raise HTTPException(status_code=400, detail="Driver already registered")
    
    # Create driver (not activated)
    driver = {
        "id": str(uuid.uuid4()),
        "phone": data.phone,
        "device_id": data.device_id,
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
    await log_action("driver_registered", driver["id"], {"phone": data.phone, "name": data.name, "device_id": data.device_id[:8]})
    
    # Send email to admin about new driver registration
    await send_admin_email(
        "Новая регистрация водителя",
        f"Новый водитель ожидает активации:\n\nФИО: {data.name}\nТелефон: {data.phone}\nАвтомобиль: {data.car_model}\nНомер: {data.car_number}\nID устройства: {data.device_id[:16]}...\nВремя: {datetime.now(timezone.utc).isoformat()}\n\nПерейдите в админ-панель для активации."
    )
    
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

@auth_router.post("/update-profile")
async def update_profile(data: ProfileUpdate, user: dict = Depends(get_current_user)):
    update_data = {}
    if data.name is not None:
        update_data["name"] = data.name
    if data.avatar is not None:
        update_data["avatar"] = data.avatar
    
    if update_data:
        await db.users.update_one({"id": user["id"]}, {"$set": update_data})
        await log_action("profile_updated", user["id"], update_data)
    
    updated_user = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return updated_user

@auth_router.post("/update-location")
async def update_location(data: LocationUpdate, user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"location": {"lat": data.lat, "lng": data.lng}, "location_updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    await log_action("location_updated", user["id"], {"lat": data.lat, "lng": data.lng})
    return {"success": True}

# ============ ORDERS ROUTES ============

@orders_router.post("/create")
async def create_order(data: OrderCreate, request: Request, user: dict = Depends(get_current_user)):
    client_ip = get_client_ip(request)
    if user["role"] != "customer":
        raise HTTPException(status_code=403, detail="Только пассажиры могут создавать заказы")
    
    # Check for existing pending order
    existing = await db.orders.find_one({
        "customer_id": user["id"],
        "status": {"$in": ["pending", "accepted"]}
    })
    if existing:
        raise HTTPException(status_code=400, detail="У вас уже есть активный заказ")
    
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
        await send_notification(driver["id"], "Новая заявка", f"Адрес: {data.address}", "push", event="order_created_driver", ip=client_ip)
    
    order.pop("_id", None)
    return order

@orders_router.get("/my-orders")
async def get_my_orders(user: dict = Depends(get_current_user)):
    if user["role"] == "customer":
        orders = await db.orders.find({"customer_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    else:
        orders = await db.orders.find({"driver_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return orders

@orders_router.get("/my-active")
async def get_my_active_order(user: dict = Depends(get_current_user)):
    """Get customer's current active order (for polling)"""
    order = await db.orders.find_one(
        {"customer_id": user["id"], "status": {"$in": ["pending", "accepted"]}},
        {"_id": 0}
    )
    if not order:
        return {"status": "none"}
    
    # If accepted, add driver location
    if order.get("status") == "accepted" and order.get("driver_id"):
        driver = await db.users.find_one(
            {"id": order["driver_id"]},
            {"_id": 0, "name": 1, "car_model": 1, "car_number": 1, "phone": 1, "location": 1, "avatar": 1}
        )
        if driver:
            order["driver_name"] = driver.get("name", "")
            order["driver_car"] = driver.get("car_model", "")
            order["driver_car_number"] = driver.get("car_number", "")
            order["driver_phone"] = driver.get("phone", "")
            order["driver_location"] = driver.get("location")
            order["driver_avatar"] = driver.get("avatar", "")
    
    return order


@orders_router.get("/history")
async def get_order_history(user: dict = Depends(get_current_user)):
    """Get order history with status changes for user's app"""
    if user["role"] == "customer":
        orders = await db.orders.find({"customer_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    else:
        orders = await db.orders.find({"driver_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    # Add status history for each order
    for order in orders:
        history = []
        history.append({"status": "created", "status_ru": "Создан", "time": order["created_at"]})
        if order.get("accepted_at"):
            history.append({"status": "accepted", "status_ru": "Принят", "time": order["accepted_at"]})
        if order.get("completed_at"):
            history.append({"status": "completed", "status_ru": "Завершён", "time": order["completed_at"]})
        if order.get("cancelled_at"):
            history.append({"status": "cancelled", "status_ru": "Отменён", "time": order["cancelled_at"]})
        if order.get("status") == "problem":
            history.append({"status": "problem", "status_ru": "Проблема", "time": order.get("completed_at") or order.get("accepted_at")})
        order["history"] = history
    
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
async def accept_order(order_id: str, request: Request, data: dict = None, user: dict = Depends(get_current_user)):
    client_ip = get_client_ip(request)
    if user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Только водители могут принимать заказы")
    
    if not user.get("is_activated"):
        raise HTTPException(status_code=403, detail="Водитель не активирован")
    
    if user.get("is_busy"):
        raise HTTPException(status_code=400, detail="У вас уже есть активный заказ")
    
    # Check balance
    balance = user.get("balance", 0)
    is_reliable = user.get("is_reliable", False)
    min_balance = -20 if is_reliable else 0
    
    if balance <= min_balance:
        raise HTTPException(status_code=400, detail="Недостаточно средств на балансе")
    
    # Get ETA from request body
    eta_minutes = None
    if data and isinstance(data, dict):
        eta_minutes = data.get("eta_minutes")
    
    # Try to accept order
    update_fields = {
        "status": "accepted",
        "driver_id": user["id"],
        "driver_name": user.get("name"),
        "driver_phone": user["phone"],
        "driver_car": user.get("car_model"),
        "driver_car_number": user.get("car_number"),
        "accepted_at": datetime.now(timezone.utc).isoformat()
    }
    if eta_minutes:
        update_fields["eta_minutes"] = eta_minutes
    
    result = await db.orders.find_one_and_update(
        {"id": order_id, "status": "pending"},
        {"$set": update_fields},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=400, detail="Заказ уже недоступен")
    
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
    await send_notification(result["customer_id"], "Водитель найден", f"Водитель {user.get('name')} едет к вам", "push", event="order_accepted_customer", ip=client_ip)
    
    # Notify other drivers that order is taken
    await manager.broadcast_to_drivers({"type": "order_taken", "order_id": order_id}, user["id"])
    
    result.pop("_id", None)
    return result

@orders_router.post("/complete/{order_id}")
async def complete_order(order_id: str, request: Request, user: dict = Depends(get_current_user)):
    client_ip = get_client_ip(request)
    if user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Только водители могут завершать заказы")
    
    order = await db.orders.find_one({"id": order_id, "driver_id": user["id"], "status": "accepted"})
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
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
    await send_notification(order["customer_id"], "Поездка завершена", "Спасибо что воспользовались сервисом!", "push", event="order_completed_customer", ip=client_ip)
    
    return {"success": True}

@orders_router.post("/cancel/{order_id}")
async def cancel_order(order_id: str, request: Request, user: dict = Depends(get_current_user)):
    client_ip = get_client_ip(request)
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    if user["role"] == "customer" and order["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Это не ваш заказ")
    
    if user["role"] == "driver" and order["driver_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Это не ваш заказ")
    
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
    
    # Notify the OTHER party via push
    try:
        if user["role"] == "customer" and order.get("driver_id"):
            await send_notification(
                order["driver_id"],
                "Заказ отменён",
                "Пассажир отменил поездку",
                "push",
                event="order_cancelled_driver",
                ip=client_ip
            )
        elif user["role"] == "driver":
            await send_notification(
                order["customer_id"],
                "Заказ отменён водителем",
                "Водитель отменил поездку. Попробуйте вызвать другого.",
                "push",
                event="order_cancelled_customer",
                ip=client_ip
            )
    except Exception:
        pass
    
    return {"success": True}

@orders_router.post("/problem/{order_id}")
async def report_problem(order_id: str, data: ProblemReport, request: Request, user: dict = Depends(get_current_user)):
    client_ip = get_client_ip(request)
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
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
    
    # Notify the OTHER party via push
    try:
        if reporter_type == "driver" and order.get("customer_id"):
            await send_notification(
                order["customer_id"],
                "Проблема с заказом",
                f"Водитель сообщил о проблеме: {data.reason}",
                "push",
                event="order_problem_customer",
                ip=client_ip
            )
        elif reporter_type == "customer" and order.get("driver_id"):
            await send_notification(
                order["driver_id"],
                "Проблема с заказом",
                f"Пассажир сообщил о проблеме: {data.reason}",
                "push",
                event="order_problem_driver",
                ip=client_ip
            )
    except Exception:
        pass
    
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
        raise HTTPException(status_code=403, detail="Только для водителей")
    
    if not user.get("is_activated"):
        raise HTTPException(status_code=403, detail="Водитель не активирован")
    
    new_status = not user.get("is_online", False)
    await db.users.update_one({"id": user["id"]}, {"$set": {"is_online": new_status}})
    
    await log_action("driver_status_change", user["id"], {"is_online": new_status})
    
    return {"is_online": new_status}

@drivers_router.get("/stats")
async def get_driver_stats():
    online_count = await db.users.count_documents({"role": "driver", "is_online": True, "is_activated": True})
    busy_count = await db.users.count_documents({"role": "driver", "is_online": True, "is_busy": True})
    return {"online": online_count, "busy": busy_count, "available": online_count - busy_count}

@drivers_router.get("/online-locations")
async def get_online_driver_locations(user: dict = Depends(get_admin_user)):
    """Get all online drivers with their locations for admin map"""
    drivers = await db.users.find(
        {"role": "driver", "is_online": True, "is_activated": True},
        {"_id": 0, "id": 1, "name": 1, "phone": 1, "car_model": 1, "car_number": 1, "location": 1, "is_busy": 1}
    ).to_list(100)
    return drivers

@drivers_router.post("/update-location")
async def update_driver_location(data: LocationUpdate, user: dict = Depends(get_current_user)):
    """Update driver location and broadcast to customer if on active order"""
    if user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Только для водителей")
    
    # Update location in DB
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "location": {"lat": data.lat, "lng": data.lng},
            "location_updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # If driver has active order, send location to customer via WebSocket
    active_order = await db.orders.find_one({
        "driver_id": user["id"],
        "status": "accepted"
    })
    
    if active_order:
        # Calculate simple ETA (mock: ~1 min per 0.01 degree distance)
        customer = await db.users.find_one({"id": active_order["customer_id"]})
        customer_loc = customer.get("location") if customer else None
        
        eta_minutes = 5  # default
        if customer_loc:
            # Simple distance calculation
            lat_diff = abs(data.lat - customer_loc.get("lat", data.lat))
            lng_diff = abs(data.lng - customer_loc.get("lng", data.lng))
            distance = (lat_diff ** 2 + lng_diff ** 2) ** 0.5
            eta_minutes = max(1, int(distance * 500))  # rough estimate
        
        # Send to customer
        await manager.send_to_user(active_order["customer_id"], {
            "type": "driver_location",
            "driver_id": user["id"],
            "location": {"lat": data.lat, "lng": data.lng},
            "eta_minutes": eta_minutes,
            "driver_name": user.get("name"),
            "car_model": user.get("car_model"),
            "car_number": user.get("car_number")
        })
    
    return {"success": True}

@drivers_router.get("/location/{driver_id}")
async def get_driver_location(driver_id: str, user: dict = Depends(get_current_user)):
    """Get driver location for customer tracking"""
    # Verify customer has active order with this driver
    if user["role"] == "customer":
        order = await db.orders.find_one({
            "customer_id": user["id"],
            "driver_id": driver_id,
            "status": "accepted"
        })
        if not order:
            raise HTTPException(status_code=403, detail="No active order with this driver")
    
    driver = await db.users.find_one(
        {"id": driver_id, "role": "driver"},
        {"_id": 0, "id": 1, "name": 1, "location": 1, "car_model": 1, "car_number": 1, "phone": 1}
    )
    
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    # Calculate ETA
    customer_loc = user.get("location")
    driver_loc = driver.get("location")
    
    eta_minutes = 5
    if customer_loc and driver_loc:
        lat_diff = abs(driver_loc.get("lat", 0) - customer_loc.get("lat", 0))
        lng_diff = abs(driver_loc.get("lng", 0) - customer_loc.get("lng", 0))
        distance = (lat_diff ** 2 + lng_diff ** 2) ** 0.5
        eta_minutes = max(1, int(distance * 500))
    
    driver["eta_minutes"] = eta_minutes
    return driver

# ============ ADMIN ROUTES ============

@admin_router.post("/login")
async def admin_login(data: AdminLogin):
    admin = await db.users.find_one({"email": data.email, "role": "admin"})
    if not admin or not verify_password(data.password, admin.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    
    token = create_access_token(admin["id"], "admin")
    admin.pop("_id", None)
    admin.pop("password_hash", None)
    
    await log_action("admin_login", admin["id"], {"email": data.email})
    
    return {"token": token, "user": admin}

@admin_router.get("/me")
async def admin_get_me(user: dict = Depends(get_admin_user)):
    admin = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    if not admin:
        raise HTTPException(status_code=404, detail="Администратор не найден")
    return admin

@admin_router.post("/me/credentials")
async def admin_update_credentials(data: AdminCredentialsUpdate, user: dict = Depends(get_admin_user)):
    admin = await db.users.find_one({"id": user["id"]})
    if not admin:
        raise HTTPException(status_code=404, detail="Администратор не найден")
    # Verify current password
    if not verify_password(data.current_password, admin.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Текущий пароль неверен")
    update = {}
    if data.new_email:
        new_email = data.new_email.strip().lower()
        if "@" not in new_email or len(new_email) < 5:
            raise HTTPException(status_code=400, detail="Некорректный email")
        # Check email collision (other admin/user with same email)
        existing = await db.users.find_one({"email": new_email, "id": {"$ne": user["id"]}})
        if existing:
            raise HTTPException(status_code=400, detail="Этот email уже используется")
        update["email"] = new_email
    if data.new_password:
        if len(data.new_password) < 6:
            raise HTTPException(status_code=400, detail="Пароль должен быть минимум 6 символов")
        update["password_hash"] = hash_password(data.new_password)
    if not update:
        raise HTTPException(status_code=400, detail="Нечего обновлять")
    await db.users.update_one({"id": user["id"]}, {"$set": update})
    await log_action("admin_credentials_updated", user["id"], {
        "email_changed": "email" in update,
        "password_changed": "password_hash" in update
    })
    # Update test_credentials.md only when password changes (preserve last-known password otherwise)
    try:
        if data.new_password:
            admin_after = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
            os.makedirs("/app/memory", exist_ok=True)
            with open("/app/memory/test_credentials.md", "w") as f:
                f.write("# Test Credentials\n\n")
                f.write(f"## Admin\n- Email: {admin_after['email']}\n")
                f.write(f"- Password: {data.new_password}\n\n")
                f.write("## Test Customer\n- Phone: +79001234567\n- SMS Code: 1234\n\n")
                f.write("## Test Driver\n- Phone: +79007654321\n- SMS Code: 1234\n- (needs admin activation)\n")
        elif data.new_email:
            # Only rewrite the Email line in the existing file
            path = "/app/memory/test_credentials.md"
            if os.path.exists(path):
                with open(path) as f:
                    content = f.read()
                import re as _re
                content = _re.sub(r"(- Email:\s*).*", f"- Email: {data.new_email.strip().lower()}", content, count=1)
                with open(path, "w") as f:
                    f.write(content)
    except Exception:
        pass
    return {"success": True, "email": update.get("email", admin["email"])}

@admin_router.get("/users")
async def get_all_users(role: Optional[str] = None, user: dict = Depends(get_admin_user)):
    query = {} if not role else {"role": role}
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users

@admin_router.get("/users/{user_id}")
async def get_user_details(user_id: str, user: dict = Depends(get_admin_user)):
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
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
    await send_notification(user_id, "Аккаунт активирован", "Ваш аккаунт водителя активирован!", "push", event="driver_activated")
    
    return {"success": True}

@admin_router.post("/users/{user_id}/deactivate")
async def deactivate_driver(user_id: str, user: dict = Depends(get_admin_user)):
    await db.users.update_one({"id": user_id}, {"$set": {"is_activated": False, "is_online": False}})
    await log_action("driver_deactivated", user_id, {"deactivated_by": user["id"]})
    return {"success": True}

@admin_router.post("/users/{user_id}/update")
async def update_user(user_id: str, data: dict, user: dict = Depends(get_admin_user)):
    allowed_fields = ["name", "balance", "admin_notes", "is_reliable", "car_model", "car_number", "phone", "avatar", "is_activated"]
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    await log_action("user_updated", user_id, {"updated_by": user["id"], "fields": list(update_data.keys())})
    
    return {"success": True}

@admin_router.get("/orders/{order_id}/route")
async def get_order_route(order_id: str, user: dict = Depends(get_admin_user)):
    """Get order details for route display"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    # Get customer info
    customer = await db.users.find_one({"id": order["customer_id"]}, {"_id": 0, "location": 1, "phone": 1, "name": 1})
    
    # Get driver info if assigned
    driver = None
    if order.get("driver_id"):
        driver = await db.users.find_one({"id": order["driver_id"]}, {"_id": 0, "location": 1, "phone": 1, "name": 1, "car_model": 1, "car_number": 1})
    
    return {
        "order": order,
        "customer": customer,
        "driver": driver
    }

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

@admin_router.get("/system-logs")
async def get_system_logs(level: Optional[str] = None, source: Optional[str] = None, limit: int = 200, user: dict = Depends(get_admin_user)):
    """Get system logs with optional level/source filter"""
    query = {}
    if level:
        query["level"] = level
    if source:
        query["source"] = source
    logs = await db.system_logs.find(query, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return logs

@admin_router.delete("/system-logs")
async def clear_system_logs(user: dict = Depends(get_admin_user)):
    """Clear all system logs"""
    result = await db.system_logs.delete_many({})
    await system_log("info", "admin", f"Системные логи очищены ({result.deleted_count} записей)")
    return {"success": True, "deleted": result.deleted_count}

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
    
    blocked_devices = await db.blocked_devices.count_documents({"is_blocked": True})
    
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
        },
        "blocked_devices": blocked_devices
    }

@admin_router.get("/blocked-devices")
async def get_blocked_devices(user: dict = Depends(get_admin_user)):
    """Get all blocked devices"""
    devices = await db.blocked_devices.find({}, {"_id": 0}).sort("blocked_at", -1).to_list(100)
    return devices

@admin_router.post("/block-device")
async def admin_block_device(data: DeviceBlock, user: dict = Depends(get_admin_user)):
    """Block a device manually"""
    await block_device(data.device_id, data.reason or "Заблокировано администратором")
    return {"success": True}

@admin_router.post("/unblock-device/{device_id}")
async def admin_unblock_device(device_id: str, user: dict = Depends(get_admin_user)):
    """Unblock a device"""
    await db.blocked_devices.update_one(
        {"device_id": device_id},
        {"$set": {"is_blocked": False, "unblocked_at": datetime.now(timezone.utc).isoformat(), "unblocked_by": user["id"]}}
    )
    await log_action("device_unblocked", None, {"device_id": device_id, "unblocked_by": user["id"]})
    return {"success": True}

# ============ MODULES & UPDATES ROUTES ============

@admin_router.get("/modules")
async def get_modules(user: dict = Depends(get_admin_user)):
    """Get list of installed modules"""
    modules = []
    async for m in db.modules.find({}, {"_id": 0}):
        modules.append(m)
    return modules

@admin_router.post("/modules")
async def install_module(data: dict, user: dict = Depends(get_admin_user)):
    """Register a new module"""
    module_id = str(uuid.uuid4())[:8]
    module = {
        "id": module_id,
        "name": data.get("name", ""),
        "description": data.get("description", ""),
        "version": data.get("version", "1.0"),
        "enabled": True,
        "archive_path": "",
        "installed_at": datetime.now(timezone.utc).isoformat(),
        "installed_by": user["id"]
    }
    await db.modules.insert_one(module)
    await log_action("module_installed", user["id"], {"module": module["name"]})
    return {"success": True, "module": {k: v for k, v in module.items() if k != "_id"}}

@admin_router.post("/modules/{module_id}/upload")
async def upload_module_archive(module_id: str, file: UploadFile = File(...), user: dict = Depends(get_admin_user)):
    """Upload ZIP archive for a module"""
    module = await db.modules.find_one({"id": module_id})
    if not module:
        raise HTTPException(status_code=404, detail="Модуль не найден")
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Допустим только формат ZIP")
    
    modules_dir = os.path.join(os.path.dirname(__file__), "uploads", "modules")
    os.makedirs(modules_dir, exist_ok=True)
    
    # Remove old archive if exists
    old_path = module.get("archive_path", "")
    if old_path:
        full_old = os.path.join(os.path.dirname(__file__), old_path.lstrip("/"))
        if os.path.exists(full_old):
            os.remove(full_old)
    
    safe_name = f"{module_id}_{file.filename}"
    file_path = os.path.join(modules_dir, safe_name)
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    
    archive_url = f"/uploads/modules/{safe_name}"
    await db.modules.update_one({"id": module_id}, {"$set": {"archive_path": archive_url, "filename": file.filename}})
    await log_action("module_archive_uploaded", user["id"], {"module": module["name"], "file": file.filename})
    return {"success": True, "archive_path": archive_url}

@admin_router.post("/modules/{module_id}/toggle")
async def toggle_module(module_id: str, user: dict = Depends(get_admin_user)):
    """Enable or disable a module"""
    module = await db.modules.find_one({"id": module_id})
    if not module:
        raise HTTPException(status_code=404, detail="Модуль не найден")
    
    new_state = not module.get("enabled", True)
    await db.modules.update_one({"id": module_id}, {"$set": {"enabled": new_state}})
    await log_action("module_toggled", user["id"], {"module": module["name"], "enabled": new_state})
    return {"success": True, "enabled": new_state}

@admin_router.delete("/modules/{module_id}")
async def delete_module(module_id: str, user: dict = Depends(get_admin_user)):
    """Remove a module and its archive"""
    module = await db.modules.find_one({"id": module_id})
    if not module:
        raise HTTPException(status_code=404, detail="Модуль не найден")
    
    # Remove archive file if exists
    archive_path = module.get("archive_path", "")
    if archive_path:
        full_path = os.path.join(os.path.dirname(__file__), archive_path.lstrip("/"))
        if os.path.exists(full_path):
            os.remove(full_path)
    
    await db.modules.delete_one({"id": module_id})
    await log_action("module_deleted", user["id"], {"module": module.get("name", module_id)})
    return {"success": True}

@admin_router.post("/update/upload")
async def upload_update(file: UploadFile = File(...), user: dict = Depends(get_admin_user)):
    """Upload update archive (ZIP) and apply it"""
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Допустим только формат ZIP")
    
    if file.size and file.size > 100 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Максимальный размер: 100 МБ")
    
    # Save archive
    update_dir = ROOT_DIR / "updates"
    update_dir.mkdir(exist_ok=True)
    
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    archive_path = update_dir / f"update_{timestamp}.zip"
    
    content = await file.read()
    with open(archive_path, "wb") as f:
        f.write(content)
    
    # Unzip to temp dir and inspect contents
    import zipfile
    extract_dir = update_dir / f"update_{timestamp}"
    
    try:
        with zipfile.ZipFile(str(archive_path), 'r') as zf:
            file_list = zf.namelist()
            zf.extractall(str(extract_dir))
    except zipfile.BadZipFile:
        archive_path.unlink(missing_ok=True)
        await system_log("error", "update", f"Повреждённый ZIP: {file.filename}")
        raise HTTPException(status_code=400, detail="Повреждённый ZIP-архив")
    
    # Determine what to update
    updated_parts = []
    
    # Check for backend files
    backend_src = extract_dir / "backend"
    if backend_src.is_dir():
        for item in backend_src.iterdir():
            target = ROOT_DIR / item.name
            if item.is_file():
                shutil.copy2(str(item), str(target))
            elif item.is_dir():
                if target.exists():
                    shutil.rmtree(str(target))
                shutil.copytree(str(item), str(target))
        updated_parts.append("backend")
    
    # Check for frontend/build (pre-built)
    frontend_build_src = extract_dir / "frontend" / "build"
    if frontend_build_src.is_dir():
        frontend_build_target = ROOT_DIR.parent / "frontend" / "build"
        if frontend_build_target.exists():
            shutil.rmtree(str(frontend_build_target))
        shutil.copytree(str(frontend_build_src), str(frontend_build_target))
        updated_parts.append("frontend (build)")
    
    # Check for frontend source (needs rebuild on server)
    frontend_src = extract_dir / "frontend" / "src"
    if frontend_src.is_dir() and not frontend_build_src.is_dir():
        frontend_target = ROOT_DIR.parent / "frontend"
        for item in (extract_dir / "frontend").iterdir():
            target = frontend_target / item.name
            if item.is_file():
                shutil.copy2(str(item), str(target))
            elif item.is_dir():
                if target.exists():
                    shutil.rmtree(str(target))
                shutil.copytree(str(item), str(target))
        updated_parts.append("frontend (source — требуется yarn build)")
    
    # Save update record
    update_record = {
        "id": f"upd_{timestamp}",
        "filename": file.filename,
        "size": len(content),
        "parts": updated_parts,
        "files_count": len(file_list),
        "applied_at": datetime.now(timezone.utc).isoformat(),
        "applied_by": user["id"]
    }
    await db.updates.insert_one(update_record)
    
    # Cleanup extracted files
    shutil.rmtree(str(extract_dir), ignore_errors=True)
    
    await log_action("update_applied", user["id"], {"filename": file.filename, "parts": updated_parts})
    await system_log("info", "update", f"Обновление применено: {file.filename}", {"parts": updated_parts, "files": len(file_list)})
    
    return {
        "success": True,
        "parts_updated": updated_parts,
        "files_count": len(file_list),
        "message": f"Обновление применено: {', '.join(updated_parts) if updated_parts else 'файлы загружены'}"
    }

@admin_router.get("/updates")
async def get_updates(user: dict = Depends(get_admin_user)):
    """Get history of applied updates"""
    updates = []
    async for u in db.updates.find({}, {"_id": 0}).sort("applied_at", -1).limit(50):
        updates.append(u)
    return updates

@admin_router.post("/test-smtp")
async def test_smtp(user: dict = Depends(get_admin_user)):
    """Send a test email to admin"""
    settings = await db.settings.find_one({"id": "main"})
    admin_email = settings.get("admin_email", "") if settings else ""
    if not admin_email:
        raise HTTPException(status_code=400, detail="Email админа не задан")
    
    sent = await send_email(
        admin_email, 
        "Тест SMTP — Такси «Рядом»", 
        "Если вы видите это письмо, SMTP настроен правильно!",
        "<div style='font-family:Inter,sans-serif;padding:20px'><h2>SMTP работает!</h2><p>Если вы видите это письмо, SMTP настроен правильно.</p></div>"
    )
    if sent:
        return {"success": True, "message": f"Тестовое письмо отправлено на {admin_email}"}
    else:
        raise HTTPException(status_code=500, detail="Не удалось отправить. Проверьте SMTP-настройки в логах.")

@api_router.post("/notifications/test-self")
async def notify_test_self(user: dict = Depends(get_current_user)):
    """Send a test push to the current user (any role). Helps verify subscription."""
    await send_notification(
        user["id"],
        "Тест уведомлений",
        "Если вы видите это сообщение — push настроен правильно.",
        "push"
    )
    # Find the most recent notification record for this user
    last = await db.notifications.find_one(
        {"user_id": user["id"]},
        {"_id": 0, "status": 1, "error": 1, "onesignal_id": 1},
        sort=[("sent_at", -1)]
    )
    return {"success": True, "delivery": last}

@admin_router.get("/push-diagnostics/{user_id}")
async def push_diagnostics(user_id: str, user: dict = Depends(get_admin_user)):
    """Full diagnostic info about a user's OneSignal subscription status."""
    settings = await db.settings.find_one({"id": "main"})
    app_id = (settings or {}).get("onesignal_app_id", "")
    api_key = (settings or {}).get("onesignal_api_key", "")
    if not app_id or not api_key:
        raise HTTPException(status_code=400, detail="OneSignal не настроен")
    
    # 1. Find user in our DB
    db_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0, "pin_hash": 0})
    
    import requests as http_requests
    is_v2 = api_key.startswith("os_v2_")
    headers = {"Authorization": (f"Key {api_key}" if is_v2 else f"Basic {api_key}")}
    
    diag = {
        "user_in_db": db_user,
        "onesignal_user": None,
        "onesignal_subscriptions": [],
        "last_5_notifications": [],
    }
    
    # 2. Query OneSignal by external_id
    try:
        url = f"https://api.onesignal.com/apps/{app_id}/users/by/external_id/{user_id}"
        r = http_requests.get(url, headers=headers, timeout=10)
        if r.status_code == 200:
            data = r.json()
            diag["onesignal_user"] = data
            diag["onesignal_subscriptions"] = data.get("subscriptions", [])
        else:
            diag["onesignal_user"] = {"http_status": r.status_code, "body": r.text[:500]}
    except Exception as e:
        diag["onesignal_user_error"] = str(e)
    
    # 3. Last 5 notifications for this user
    notifs = await db.notifications.find({"user_id": user_id}, {"_id": 0}).sort("sent_at", -1).limit(5).to_list(5)
    diag["last_5_notifications"] = notifs
    
    return diag


@admin_router.post("/test-push")
async def test_push(user: dict = Depends(get_admin_user)):
    """Send a test push notification to admin themselves"""
    settings = await db.settings.find_one({"id": "main"})
    if not settings or not settings.get("onesignal_app_id"):
        raise HTTPException(status_code=400, detail="OneSignal не настроен")
    
    await send_notification(user["id"], "Тест Push", "Push-уведомления работают!", "push")
    return {"success": True, "message": "Тестовый push отправлен"}

@admin_router.post("/push-status")
async def push_status_bulk(payload: dict, user: dict = Depends(get_admin_user)):
    """Returns push subscription status for a list of user_ids.
    Body: {"user_ids": ["uuid1", "uuid2", ...]}
    Returns: {"statuses": {"uuid1": "subscribed", "uuid2": "blocked", "uuid3": "unknown", ...}}
    """
    user_ids = payload.get("user_ids") or []
    if not isinstance(user_ids, list) or len(user_ids) > 100:
        raise HTTPException(status_code=400, detail="user_ids must be a list (max 100)")
    settings = await db.settings.find_one({"id": "main"})
    app_id = (settings or {}).get("onesignal_app_id", "")
    api_key = (settings or {}).get("onesignal_api_key", "")
    if not app_id or not api_key:
        return {"statuses": {uid: "no_onesignal" for uid in user_ids}}
    import requests as http_requests
    is_v2 = api_key.startswith("os_v2_")
    headers = {"Authorization": (f"Key {api_key}" if is_v2 else f"Basic {api_key}")}
    statuses = {}
    async def check_one(uid: str):
        try:
            url = f"https://api.onesignal.com/apps/{app_id}/users/by/external_id/{uid}"
            r = http_requests.get(url, headers=headers, timeout=5)
            if r.status_code == 404:
                statuses[uid] = "not_registered"
                return
            if r.status_code != 200:
                statuses[uid] = "error"
                return
            data = r.json()
            subs = data.get("subscriptions") or []
            # Find any enabled subscription
            active = next((s for s in subs if s.get("enabled") and s.get("notification_types", 0) > 0), None)
            if active:
                statuses[uid] = "subscribed"
            elif any(s.get("notification_types") == -2 for s in subs):
                statuses[uid] = "blocked"
            elif subs:
                statuses[uid] = "pending"  # has subscription record but not enabled
            else:
                statuses[uid] = "not_registered"
        except Exception:
            statuses[uid] = "error"
    # Run sequentially (sync requests inside async); limit is 100
    for uid in user_ids:
        await check_one(uid)
    return {"statuses": statuses}


@admin_router.post("/test-push/{user_id}")
async def test_push_to_user(user_id: str, user: dict = Depends(get_admin_user)):
    """Send a test push to a specific user (driver/customer) — admin verifies subscription."""
    settings = await db.settings.find_one({"id": "main"})
    if not settings or not settings.get("onesignal_app_id"):
        raise HTTPException(status_code=400, detail="OneSignal не настроен")
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "name": 1, "phone": 1, "role": 1})
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    await send_notification(user_id, "Проверка связи", f"Это тест от администратора. Если видите — push работает.", "push")
    last = await db.notifications.find_one(
        {"user_id": user_id},
        {"_id": 0, "status": 1, "onesignal_id": 1},
        sort=[("sent_at", -1)]
    )
    return {"success": True, "target": target, "delivery": last}


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
    """Get settings that are public (terms, rules, maintenance mode, branding)"""
    settings = await db.settings.find_one({"id": "main"}, {"_id": 0})
    if not settings:
        return {
            "app_name": "Рядом",
            "app_icon_url": "",
            "maintenance_mode": False,
            "maintenance_text": "",
            "test_mode": True,
            "terms_text": "Условия использования сервиса...",
            "privacy_text": "Политика конфиденциальности...",
            "customer_rules_text": "Правила для пассажиров...",
            "driver_rules_text": "Правила для водителей..."
        }
    
    return {
        "app_name": settings.get("app_name", "Рядом"),
        "app_icon_url": settings.get("app_icon_url", ""),
        "maintenance_mode": settings.get("maintenance_mode", False),
        "maintenance_text": settings.get("maintenance_text", ""),
        "test_mode": settings.get("test_mode", True),
        "yandex_map_api_key": settings.get("yandex_map_api_key", ""),
        "google_map_api_key": settings.get("google_map_api_key", ""),
        "active_map_provider": settings.get("active_map_provider", "yandex"),
        "custom_pin_url": settings.get("custom_pin_url", ""),
        "onesignal_app_id": settings.get("onesignal_app_id", ""),
        "eta_options": settings.get("eta_options", "1,2,3,5"),
        "map_bg_color": settings.get("map_bg_color", ""),
        "map_grid_color": settings.get("map_grid_color", ""),
        "map_bg_image_url": settings.get("map_bg_image_url", ""),
        "map_bg_size": settings.get("map_bg_size", "cover"),
        "map_bg_position": settings.get("map_bg_position", "center"),
        "map_bg_repeat": settings.get("map_bg_repeat", "no-repeat"),
        "map_enabled": settings.get("map_enabled", True),
        "pwa_enabled": settings.get("pwa_enabled", True),
        "pwa_short_name": settings.get("pwa_short_name", ""),
        "pwa_prompt_text": settings.get("pwa_prompt_text", ""),
        "pwa_icon_192_url": settings.get("pwa_icon_192_url", ""),
        "pwa_icon_512_url": settings.get("pwa_icon_512_url", ""),
        "call_verify_enabled": settings.get("call_verify_enabled", False),
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

@settings_router.post("/upload-icon")
async def upload_app_icon(file: UploadFile = File(...), user: dict = Depends(get_admin_user)):
    """Upload app icon image"""
    allowed_types = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Допустимые форматы: PNG, JPEG, WebP, SVG, GIF")
    
    if file.size and file.size > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Максимальный размер: 2 МБ")
    
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "png"
    filename = f"app_icon_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = UPLOADS_DIR / filename
    
    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)
    
    # Build the URL
    icon_url = f"/api/uploads/{filename}"
    
    # Save to settings
    await db.settings.update_one(
        {"id": "main"},
        {"$set": {"app_icon_url": icon_url}},
        upsert=True
    )
    
    await log_action("app_icon_updated", user["id"], {"filename": filename})
    
    return {"success": True, "url": icon_url}

@api_router.get("/manifest.json")
async def get_manifest():
    """Dynamically generated PWA manifest based on admin settings"""
    settings = await db.settings.find_one({"id": "main"}) or {}
    name = settings.get("app_name") or "Рядом"
    icons = []
    icon192 = settings.get("pwa_icon_192_url") or settings.get("app_icon_url") or ""
    icon512 = settings.get("pwa_icon_512_url") or settings.get("app_icon_url") or ""
    if icon192:
        icons.append({"src": icon192, "sizes": "192x192", "type": "image/png", "purpose": "any"})
    if icon512:
        icons.append({"src": icon512, "sizes": "512x512", "type": "image/png", "purpose": "maskable"})
    return {
        "name": name,
        "short_name": settings.get("pwa_short_name") or name,
        "description": f"{name} — сервис заказа поездок",
        "start_url": "/",
        "scope": "/",
        "display": "standalone",
        "orientation": "portrait",
        "background_color": "#ffffff",
        "theme_color": "#16a34a",
        "icons": icons
    }

@settings_router.post("/upload-pwa-icon")
async def upload_pwa_icon(size: str = Form("192"), file: UploadFile = File(...), user: dict = Depends(get_admin_user)):
    """Upload PWA manifest icon (192 or 512)"""
    if size not in ("192", "512"):
        raise HTTPException(status_code=400, detail="size должен быть 192 или 512")
    if file.content_type not in ["image/png", "image/jpeg", "image/webp"]:
        raise HTTPException(status_code=400, detail="Допустимые форматы: PNG, JPEG, WebP")
    if file.size and file.size > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Максимальный размер: 2 МБ")
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "png"
    filename = f"pwa_icon_{size}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = UPLOADS_DIR / filename
    with open(filepath, "wb") as f:
        f.write(await file.read())
    icon_url = f"/api/uploads/{filename}"
    await db.settings.update_one({"id": "main"}, {"$set": {f"pwa_icon_{size}_url": icon_url}}, upsert=True)
    await log_action("pwa_icon_updated", user["id"], {"filename": filename, "size": size})
    return {"success": True, "url": icon_url}

@auth_router.post("/upload-avatar")
async def upload_avatar(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """Upload user avatar"""
    allowed_types = ["image/png", "image/jpeg", "image/webp", "image/gif"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Допустимые форматы: PNG, JPEG, WebP, GIF")
    
    if file.size and file.size > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Максимальный размер: 2 МБ")
    
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "png"
    filename = f"avatar_{user['id'][:8]}_{uuid.uuid4().hex[:6]}.{ext}"
    filepath = UPLOADS_DIR / filename
    
    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)
    
    avatar_url = f"/api/uploads/{filename}"
    await db.users.update_one({"id": user["id"]}, {"$set": {"avatar": avatar_url}})
    
    return {"success": True, "avatar_url": avatar_url}

@settings_router.post("/upload-pin-icon")
async def upload_pin_icon(file: UploadFile = File(...), user: dict = Depends(get_admin_user)):
    """Upload custom map pin icon"""
    allowed_types = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Допустимые форматы: PNG, JPEG, WebP, SVG, GIF")
    
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "png"
    filename = f"pin_icon_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = UPLOADS_DIR / filename
    
    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)
    
    pin_url = f"/api/uploads/{filename}"
    await db.settings.update_one({"id": "main"}, {"$set": {"custom_pin_url": pin_url}}, upsert=True)
    await log_action("pin_icon_updated", user["id"], {"filename": filename})
    
    return {"success": True, "url": pin_url}

@settings_router.post("/upload-map-bg")
async def upload_map_bg(file: UploadFile = File(...), user: dict = Depends(get_admin_user)):
    """Upload map background image"""
    allowed_types = ["image/png", "image/jpeg", "image/webp", "image/gif"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Допустимые форматы: PNG, JPEG, WebP, GIF")
    
    if file.size and file.size > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Максимальный размер: 5 МБ")
    
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg"
    filename = f"map_bg_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = UPLOADS_DIR / filename
    
    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)
    
    bg_url = f"/api/uploads/{filename}"
    await db.settings.update_one({"id": "main"}, {"$set": {"map_bg_image_url": bg_url}}, upsert=True)
    await log_action("map_bg_updated", user["id"], {"filename": filename})
    
    return {"success": True, "url": bg_url}

# ============ FAB BUTTONS ============

FAB_MAX_PER_ROLE = 3  # 3 custom + 1 fixed icon = 4 total in bar

@settings_router.get("/fab-buttons")
async def get_fab_buttons_public(role: Optional[str] = None):
    """Public endpoint — list active fab buttons for a role (customer or driver)."""
    if not role:
        raise HTTPException(status_code=400, detail="query parameter 'role' is required")
    if role not in ("customer", "driver"):
        raise HTTPException(status_code=400, detail="role must be 'customer' or 'driver'")
    buttons = await db.fab_buttons.find(
        {"is_active": True, "role": {"$in": [role, "both"]}},
        {"_id": 0}
    ).sort("order", 1).to_list(20)
    return buttons

@admin_router.get("/fab-buttons")
async def list_fab_buttons(user: dict = Depends(get_admin_user)):
    buttons = await db.fab_buttons.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    return buttons

@admin_router.post("/fab-buttons")
async def create_fab_button(data: FabButton, user: dict = Depends(get_admin_user)):
    if data.role not in ("customer", "driver", "both"):
        raise HTTPException(status_code=400, detail="role must be 'customer', 'driver' or 'both'")
    # Enforce limit: count active buttons that affect target role
    target_roles = [data.role] if data.role != "both" else ["customer", "driver"]
    for r in target_roles:
        count = await db.fab_buttons.count_documents({
            "is_active": True,
            "role": {"$in": [r, "both"]}
        })
        if data.is_active and count >= FAB_MAX_PER_ROLE:
            raise HTTPException(
                status_code=400,
                detail=f"Достигнут лимит активных кнопок для роли '{r}' ({FAB_MAX_PER_ROLE} макс.)"
            )
    doc = {
        "id": str(uuid.uuid4()),
        "role": data.role,
        "label": data.label,
        "icon_svg": data.icon_svg or "",
        "title": data.title or "",
        "content_html": data.content_html or "",
        "order": data.order or 0,
        "is_active": data.is_active if data.is_active is not None else True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.fab_buttons.insert_one(doc)
    await log_action("fab_button_created", user["id"], {"id": doc["id"], "label": doc["label"]})
    doc.pop("_id", None)
    return doc

@admin_router.put("/fab-buttons/{btn_id}")
async def update_fab_button(btn_id: str, data: FabButtonUpdate, user: dict = Depends(get_admin_user)):
    existing = await db.fab_buttons.find_one({"id": btn_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Кнопка не найдена")
    update = {k: v for k, v in data.dict().items() if v is not None}
    if "role" in update and update["role"] not in ("customer", "driver", "both"):
        raise HTTPException(status_code=400, detail="role must be 'customer', 'driver' or 'both'")
    # Enforce limit if activating
    will_be_active = update.get("is_active", existing.get("is_active", True))
    will_role = update.get("role", existing["role"])
    if will_be_active:
        target_roles = [will_role] if will_role != "both" else ["customer", "driver"]
        for r in target_roles:
            count = await db.fab_buttons.count_documents({
                "is_active": True,
                "role": {"$in": [r, "both"]},
                "id": {"$ne": btn_id}
            })
            if count >= FAB_MAX_PER_ROLE:
                raise HTTPException(
                    status_code=400,
                    detail=f"Достигнут лимит активных кнопок для роли '{r}' ({FAB_MAX_PER_ROLE} макс.)"
                )
    await db.fab_buttons.update_one({"id": btn_id}, {"$set": update})
    await log_action("fab_button_updated", user["id"], {"id": btn_id})
    updated = await db.fab_buttons.find_one({"id": btn_id}, {"_id": 0})
    return updated

@admin_router.delete("/fab-buttons/{btn_id}")
async def delete_fab_button(btn_id: str, user: dict = Depends(get_admin_user)):
    res = await db.fab_buttons.delete_one({"id": btn_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Кнопка не найдена")
    await log_action("fab_button_deleted", user["id"], {"id": btn_id})
    return {"success": True}

@admin_router.post("/fab-buttons/upload-svg")
async def upload_fab_svg(file: UploadFile = File(...), user: dict = Depends(get_admin_user)):
    """Upload an SVG file and return its raw text content (inlined into icon_svg)."""
    if file.content_type not in ("image/svg+xml", "text/xml", "application/xml"):
        # Allow .svg with wrong mime sometimes
        if not (file.filename or "").lower().endswith(".svg"):
            raise HTTPException(status_code=400, detail="Допустим только формат SVG")
    if file.size and file.size > 200 * 1024:
        raise HTTPException(status_code=400, detail="Максимальный размер: 200 КБ")
    content = await file.read()
    try:
        svg_text = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Файл не является валидным SVG (utf-8 decode failed)")
    if "<svg" not in svg_text:
        raise HTTPException(status_code=400, detail="Файл не содержит SVG-разметки")
    return {"success": True, "svg": svg_text}

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
    await db.fab_buttons.create_index("id", unique=True)
    await db.fab_buttons.create_index("role")
    
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
        f.write("# Test Credentials\n\n")
        f.write(f"## Admin\n- Email: {admin_email}\n- Password: {admin_password}\n\n")
        f.write("## Test Customer\n- Phone: +79001234567\n- SMS Code: 1234\n\n")
        f.write("## Test Driver\n- Phone: +79007654321\n- SMS Code: 1234\n- (needs admin activation)\n")
    
    logger.info("Taxi WebToApp API started")
    await system_log("info", "system", "Сервер запущен", {"version": "2.0"})

@app.on_event("shutdown")
async def shutdown():
    client.close()
