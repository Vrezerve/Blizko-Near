#!/bin/bash
# ============================================================
#  Инсталятор такси-сервиса «Рядом»
#  Запуск: sudo bash install.sh
# ============================================================

# НЕ используем set -e — обрабатываем ошибки вручную

# ── Цвета ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
DIM='\033[2m'
NC='\033[0m'
BOLD='\033[1m'

OK="${GREEN}[OK]${NC}"
FAIL="${RED}[X]${NC}"
WARN="${YELLOW}[!]${NC}"
INFO="${BLUE}[i]${NC}"
ARROW="${CYAN}>>>${NC}"

# ── Переменные ───────────────────────────────────────────────
INSTALL_DIR=""
DOMAIN=""
PROTOCOL="http"
STEP=0
TOTAL_STEPS=7
LOG_FILE="/tmp/taxi_install_$(date +%Y%m%d_%H%M%S).log"

# Данные по умолчанию (меняются в админке после установки)
ADMIN_EMAIL="admin@taxi.local"
ADMIN_PASSWORD="admin123"
MONGO_URL="mongodb://localhost:27017"
DB_NAME="taxi_production"
JWT_SECRET=""

# ── Функции ──────────────────────────────────────────────────

log() {
    echo "$@" >> "$LOG_FILE" 2>&1
}

print_header() {
    clear
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}${BOLD}       Инсталятор такси-сервиса «Рядом»              ${NC}${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}${DIM}       Версия 2.0 — Быстрая установка                 ${NC}${GREEN}║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_step() {
    STEP=$((STEP + 1))
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${WHITE}  Шаг ${STEP}/${TOTAL_STEPS}: $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Промпт НА stderr чтобы не попадал в переменную при $()
ask_input() {
    local prompt="$1"
    local default="$2"
    local result
    
    if [ -n "$default" ]; then
        echo -ne "  ${prompt} ${DIM}[${default}]:${NC} " >&2
    else
        echo -ne "  ${prompt}: " >&2
    fi
    
    read -r result
    echo "${result:-$default}"
}

ask_yes_no() {
    local prompt="$1"
    local default="${2:-y}"
    local answer
    
    if [ "$default" = "y" ]; then
        echo -ne "  ${prompt} ${DIM}[Y/n]:${NC} "
    else
        echo -ne "  ${prompt} ${DIM}[y/N]:${NC} "
    fi
    
    read -r answer
    answer=${answer:-$default}
    
    case "$answer" in
        [Yy]*) return 0 ;;
        *) return 1 ;;
    esac
}

check_root() {
    if [ "$(id -u)" -ne 0 ]; then
        echo -e "${FAIL} Запустите скрипт от ${BOLD}root${NC}: ${CYAN}sudo bash install.sh${NC}"
        exit 1
    fi
}

check_dependency() {
    local name="$1"
    local cmd="$2"
    local version_cmd="$3"
    
    if command -v "$cmd" &>/dev/null; then
        local ver=""
        if [ -n "$version_cmd" ]; then
            ver=$(eval "$version_cmd" 2>/dev/null | head -1)
        fi
        echo -e "  ${OK} ${name} ${DIM}${ver}${NC}"
        return 0
    else
        echo -e "  ${FAIL} ${name} ${RED}не найден${NC}"
        return 1
    fi
}

check_service() {
    local name="$1"
    local service="$2"
    
    if systemctl is-active --quiet "$service" 2>/dev/null; then
        echo -e "  ${OK} ${name} ${DIM}(запущен)${NC}"
        return 0
    elif systemctl is-enabled --quiet "$service" 2>/dev/null; then
        echo -e "  ${WARN} ${name} ${YELLOW}(не запущен — запускаем...)${NC}"
        systemctl start "$service" >> "$LOG_FILE" 2>&1
        return 0
    else
        echo -e "  ${FAIL} ${name} ${RED}не установлен${NC}"
        return 1
    fi
}

# ── Установщики ──────────────────────────────────────────────

install_nodejs() {
    echo -e "  ${ARROW} Установка Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >> "$LOG_FILE" 2>&1
    apt-get install -y nodejs >> "$LOG_FILE" 2>&1
    npm install -g yarn >> "$LOG_FILE" 2>&1
    echo -e "  ${OK} Node.js + Yarn установлены"
}

install_python() {
    echo -e "  ${ARROW} Установка Python 3..."
    apt-get install -y python3 python3-pip python3-venv python3-dev >> "$LOG_FILE" 2>&1
    echo -e "  ${OK} Python установлен"
}

install_mongodb() {
    echo -e "  ${ARROW} Установка MongoDB 7.0..."
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg 2>> "$LOG_FILE"
    local codename
    codename=$(lsb_release -cs 2>/dev/null || echo "jammy")
    echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu ${codename}/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list >> "$LOG_FILE"
    apt-get update -qq >> "$LOG_FILE" 2>&1
    if ! apt-get install -y mongodb-org >> "$LOG_FILE" 2>&1; then
        echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list >> "$LOG_FILE"
        apt-get update -qq >> "$LOG_FILE" 2>&1
        apt-get install -y mongodb-org >> "$LOG_FILE" 2>&1
    fi
    systemctl start mongod >> "$LOG_FILE" 2>&1
    systemctl enable mongod >> "$LOG_FILE" 2>&1
    echo -e "  ${OK} MongoDB установлен и запущен"
}

install_nginx() {
    echo -e "  ${ARROW} Установка Nginx..."
    apt-get install -y nginx >> "$LOG_FILE" 2>&1
    systemctl start nginx >> "$LOG_FILE" 2>&1
    systemctl enable nginx >> "$LOG_FILE" 2>&1
    echo -e "  ${OK} Nginx установлен"
}

# ════════════════════════════════════════════════════════════
#  ОСНОВНОЙ ПОТОК
# ════════════════════════════════════════════════════════════

main() {
    check_root
    print_header
    
    echo -e "  ${INFO} Лог: ${DIM}${LOG_FILE}${NC}"
    echo ""
    echo -e "  Этот инсталятор настроит ваш такси-сервис автоматически."
    echo -e "  Вам нужно ответить только на ${BOLD}1 вопрос${NC} — указать домен."
    echo -e "  Всё остальное настроится само."
    echo ""
    
    if ! ask_yes_no "Начать установку?"; then
        echo -e "\n  Установка отменена."
        exit 0
    fi

    # ══════════════════════════════════════════════════════════
    #  ШАГ 1: Директория проекта
    # ══════════════════════════════════════════════════════════
    print_step "Поиск файлов проекта"
    
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    
    if [ -f "${SCRIPT_DIR}/backend/server.py" ] && [ -f "${SCRIPT_DIR}/frontend/package.json" ]; then
        INSTALL_DIR="$SCRIPT_DIR"
        echo -e "  ${OK} Проект: ${BOLD}${INSTALL_DIR}${NC}"
    elif [ -f "/opt/taxi-app/backend/server.py" ]; then
        INSTALL_DIR="/opt/taxi-app"
        echo -e "  ${OK} Проект: ${BOLD}${INSTALL_DIR}${NC}"
    else
        echo -e "  ${FAIL} Файлы проекта не найдены!"
        echo -e "  ${DIM}Убедитесь что install.sh лежит рядом с папками backend/ и frontend/${NC}"
        exit 1
    fi
    
    # Проверка ключевых файлов
    local ok=true
    [ -f "${INSTALL_DIR}/backend/server.py" ]       && echo -e "  ${OK} backend/server.py"       || { echo -e "  ${FAIL} backend/server.py";       ok=false; }
    [ -f "${INSTALL_DIR}/backend/requirements.txt" ] && echo -e "  ${OK} backend/requirements.txt" || { echo -e "  ${FAIL} backend/requirements.txt"; ok=false; }
    [ -f "${INSTALL_DIR}/frontend/package.json" ]    && echo -e "  ${OK} frontend/package.json"    || { echo -e "  ${FAIL} frontend/package.json";    ok=false; }
    
    if [ "$ok" = false ]; then
        echo -e "\n  ${FAIL} Не все файлы на месте. Загрузите проект и повторите."
        exit 1
    fi

    # ══════════════════════════════════════════════════════════
    #  ШАГ 2: Домен
    # ══════════════════════════════════════════════════════════
    print_step "Укажите домен"
    
    # Попробовать определить домен из пути /var/www/.../домен/
    local auto_domain=""
    local server_ip
    server_ip=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
    
    # Извлечь домен из пути типа /var/www/www-root/data/www/ryadom22.ru
    if echo "$INSTALL_DIR" | grep -qE '/www/[^/]+$'; then
        auto_domain=$(basename "$INSTALL_DIR")
        # Проверить что это похоже на домен (содержит точку)
        if ! echo "$auto_domain" | grep -q '\.'; then
            auto_domain=""
        fi
    fi
    
    local default_domain="${auto_domain:-$server_ip}"
    
    echo -e "  ${DIM}IP сервера: ${server_ip}${NC}"
    if [ -n "$auto_domain" ]; then
        echo -e "  ${DIM}Обнаружен домен из пути: ${auto_domain}${NC}"
    fi
    echo -e "  ${DIM}Нажмите Enter чтобы принять значение в скобках${NC}"
    echo ""
    
    DOMAIN=$(ask_input "Ваш домен или IP" "$default_domain")
    
    echo ""
    echo -e "  ${OK} Домен: ${BOLD}${DOMAIN}${NC}"

    # ══════════════════════════════════════════════════════════
    #  ШАГ 3: Проверка и установка зависимостей
    # ══════════════════════════════════════════════════════════
    print_step "Проверка зависимостей"
    
    echo -e "  ${ARROW} Обновление пакетов..."
    apt-get update -qq >> "$LOG_FILE" 2>&1
    apt-get install -y curl wget git unzip lsb-release gnupg software-properties-common >> "$LOG_FILE" 2>&1
    
    echo ""
    
    local need_node=false need_python=false need_mongo=false need_nginx=false
    
    check_dependency "Node.js" "node" "node --version"   || need_node=true
    check_dependency "Yarn"    "yarn" "yarn --version"    || need_node=true
    check_dependency "Python 3" "python3" "python3 --version" || need_python=true
    check_dependency "pip3"    "pip3" ""                   || need_python=true
    check_service    "MongoDB" "mongod"                    || need_mongo=true
    check_service    "Nginx"   "nginx"                     || need_nginx=true
    
    echo ""
    
    if $need_node || $need_python || $need_mongo || $need_nginx; then
        echo -e "  ${ARROW} Устанавливаем недостающее..."
        $need_node   && install_nodejs
        $need_python && install_python
        $need_mongo  && install_mongodb
        $need_nginx  && install_nginx
        echo -e "  ${OK} Всё установлено"
    else
        echo -e "  ${OK} Все зависимости на месте"
    fi

    # ══════════════════════════════════════════════════════════
    #  ШАГ 4: Настройка бэкенда
    # ══════════════════════════════════════════════════════════
    print_step "Настройка бэкенда"
    
    cd "${INSTALL_DIR}/backend"
    
    # Генерация JWT
    JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || openssl rand -hex 32)
    
    # Обязательно установить python3-venv (на Ubuntu 22+/24+ он не идёт по умолчанию)
    echo -e "  ${ARROW} Проверка python3-venv..."
    apt-get install -y python3-venv python3-dev >> "$LOG_FILE" 2>&1
    
    # Если старый venv сломан (нет pip/uvicorn) — пересоздать
    if [ -d "venv" ] && [ ! -f "venv/bin/pip" ]; then
        echo -e "  ${WARN} Старый venv повреждён — пересоздаём..."
        rm -rf venv
    fi
    
    # Создание виртуального окружения
    if [ ! -d "venv" ]; then
        echo -e "  ${ARROW} Создание виртуального окружения..."
        python3 -m venv venv >> "$LOG_FILE" 2>&1
        if [ ! -f "venv/bin/pip" ]; then
            echo -e "  ${WARN} venv создан без pip, устанавливаем ensurepip..."
            python3 -m ensurepip --upgrade >> "$LOG_FILE" 2>&1 || true
            # Если ensurepip не помог — поставим pip вручную
            if [ ! -f "venv/bin/pip" ]; then
                echo -e "  ${ARROW} Скачиваем get-pip.py..."
                curl -sSL https://bootstrap.pypa.io/get-pip.py -o /tmp/get-pip.py >> "$LOG_FILE" 2>&1
                venv/bin/python3 /tmp/get-pip.py >> "$LOG_FILE" 2>&1
            fi
        fi
        echo -e "  ${OK} Виртуальное окружение создано"
    else
        echo -e "  ${OK} Виртуальное окружение (уже есть)"
    fi
    
    # Проверка что pip работает
    if [ ! -f "venv/bin/pip" ]; then
        echo -e "  ${FAIL} pip не найден в venv!"
        echo -e "  ${DIM}  Попробуйте: apt install python3-venv && rm -rf venv && bash install.sh${NC}"
        exit 1
    fi
    
    # Зависимости Python
    echo -e "  ${ARROW} Установка Python-зависимостей..."
    echo -e "  ${DIM}  (может занять 1-3 минуты)${NC}"
    
    venv/bin/pip install --upgrade pip >> "$LOG_FILE" 2>&1
    venv/bin/pip install -r requirements.txt >> "$LOG_FILE" 2>&1
    local pip_result=$?
    
    # Проверка что uvicorn установился
    if [ -f "venv/bin/uvicorn" ]; then
        echo -e "  ${OK} Python-зависимости установлены"
    else
        echo -e "  ${FAIL} uvicorn не найден — зависимости не установились!"
        echo -e "  ${DIM}  Попробуем ещё раз с подробным выводом:${NC}"
        venv/bin/pip install uvicorn fastapi motor python-jose python-multipart passlib bcrypt 2>&1 | tail -5
        if [ ! -f "venv/bin/uvicorn" ]; then
            echo -e "  ${FAIL} Критическая ошибка. Подробности: ${LOG_FILE}"
            echo -e "  ${DIM}  Ручное решение: cd ${INSTALL_DIR}/backend && source venv/bin/activate && pip install -r requirements.txt${NC}"
            exit 1
        fi
        echo -e "  ${OK} Python-зависимости установлены (со второй попытки)"
    fi
    
    # .env файл
    local CORS_ORIGINS="${PROTOCOL}://${DOMAIN}"
    if ! echo "$DOMAIN" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
        CORS_ORIGINS="${PROTOCOL}://${DOMAIN},${PROTOCOL}://www.${DOMAIN}"
    fi
    
    cat > .env << ENVEOF
MONGO_URL=${MONGO_URL}
DB_NAME=${DB_NAME}
JWT_SECRET=${JWT_SECRET}
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
CORS_ORIGINS=${CORS_ORIGINS}
ENVEOF
    
    chmod 600 .env
    echo -e "  ${OK} Файл .env создан"
    
    mkdir -p uploads
    echo -e "  ${OK} Папка uploads"

    # ══════════════════════════════════════════════════════════
    #  ШАГ 5: Сборка фронтенда
    # ══════════════════════════════════════════════════════════
    print_step "Сборка фронтенда"
    
    cd "${INSTALL_DIR}/frontend"
    
    # .env
    cat > .env << ENVEOF
REACT_APP_BACKEND_URL=${PROTOCOL}://${DOMAIN}
ENVEOF
    
    echo -e "  ${OK} Файл .env фронтенда"
    
    # Установка JS-зависимостей
    echo -e "  ${ARROW} Установка JS-зависимостей (yarn)..."
    echo -e "  ${DIM}  (может занять 2-5 минут)${NC}"
    
    yarn install --production=false >> "$LOG_FILE" 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "  ${OK} JS-зависимости установлены"
    else
        echo -e "  ${WARN} Ошибки при yarn install"
        echo -e "  ${DIM}  Подробности: ${LOG_FILE}${NC}"
    fi
    
    # Сборка
    echo -e "  ${ARROW} Сборка (yarn build)..."
    echo -e "  ${DIM}  (может занять 1-3 минуты)${NC}"
    
    yarn build >> "$LOG_FILE" 2>&1
    
    if [ -f "build/index.html" ]; then
        echo -e "  ${OK} Фронтенд собран"
    else
        echo -e "  ${FAIL} Сборка не удалась!"
        echo -e "  ${DIM}  Подробности: ${LOG_FILE}${NC}"
    fi

    # ══════════════════════════════════════════════════════════
    #  ШАГ 6: Запуск сервисов
    # ══════════════════════════════════════════════════════════
    print_step "Запуск сервисов"
    
    # --- systemd сервис для бэкенда ---
    cat > /etc/systemd/system/taxi-backend.service << SVCEOF
[Unit]
Description=Taxi Ryadom Backend API
After=network.target mongod.service
Wants=mongod.service

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}/backend
Environment=PATH=${INSTALL_DIR}/backend/venv/bin:/usr/local/bin:/usr/bin:/bin
EnvironmentFile=${INSTALL_DIR}/backend/.env
ExecStart=${INSTALL_DIR}/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVCEOF
    
    systemctl daemon-reload >> "$LOG_FILE" 2>&1
    systemctl stop taxi-backend >> "$LOG_FILE" 2>&1
    sleep 1
    systemctl start taxi-backend >> "$LOG_FILE" 2>&1
    systemctl enable taxi-backend >> "$LOG_FILE" 2>&1
    
    sleep 4
    
    if systemctl is-active --quiet taxi-backend; then
        echo -e "  ${OK} Бэкенд запущен"
    else
        echo -e "  ${FAIL} Бэкенд не запустился"
        echo -e "  ${DIM}  Проверяем причину...${NC}"
        
        # Проверяем что uvicorn вообще существует
        if [ ! -f "${INSTALL_DIR}/backend/venv/bin/uvicorn" ]; then
            echo -e "  ${FAIL} uvicorn не найден в ${INSTALL_DIR}/backend/venv/bin/"
            echo -e "  ${DIM}  Решение: cd ${INSTALL_DIR}/backend && venv/bin/pip install uvicorn && systemctl restart taxi-backend${NC}"
        else
            echo -e "  ${DIM}  uvicorn найден: $(ls -la ${INSTALL_DIR}/backend/venv/bin/uvicorn)${NC}"
        fi
        
        echo ""
        echo -e "  ${DIM}  Последние логи:${NC}"
        journalctl -u taxi-backend -n 10 --no-pager 2>/dev/null || true
        echo ""
        
        # Попробуем запустить вручную для диагностики
        echo -e "  ${ARROW} Пробуем запустить напрямую для диагностики..."
        cd "${INSTALL_DIR}/backend"
        timeout 5 venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001 >> "$LOG_FILE" 2>&1 &
        local test_pid=$!
        sleep 3
        
        if curl -s --max-time 3 http://localhost:8001/api/settings/public | grep -q "app_name"; then
            echo -e "  ${OK} API работает при ручном запуске!"
            echo -e "  ${WARN} Проблема в systemd сервисе. Перезапускаем..."
            kill $test_pid 2>/dev/null || true
            wait $test_pid 2>/dev/null || true
            sleep 1
            systemctl restart taxi-backend >> "$LOG_FILE" 2>&1
            sleep 3
        else
            kill $test_pid 2>/dev/null || true
            wait $test_pid 2>/dev/null || true
            echo -e "  ${FAIL} API не отвечает даже при ручном запуске"
            echo -e "  ${DIM}  Подробности: ${LOG_FILE}${NC}"
        fi
    fi
    
    # API проверка
    sleep 2
    if curl -s --max-time 5 http://localhost:8001/api/settings/public | grep -q "app_name"; then
        echo -e "  ${OK} API отвечает"
    else
        echo -e "  ${WARN} API пока не отвечает (подождите 10 сек и проверьте)"
    fi
    
    # --- Инициализация настроек в БД ---
    echo -e "  ${ARROW} Инициализация базы данных..."
    
    cd "${INSTALL_DIR}/backend"
    MONGO_URL="${MONGO_URL}" DB_NAME="${DB_NAME}" venv/bin/python3 << 'PYEOF'
import os
from pymongo import MongoClient

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
db_name = os.environ.get("DB_NAME", "taxi_production")

client = MongoClient(mongo_url)
db = client[db_name]

# Настройки по умолчанию
db.settings.update_one(
    {"id": "main"},
    {"$setOnInsert": {
        "id": "main",
        "app_name": "Рядом",
        "test_mode": True,
        "active_map_provider": "yandex",
    }},
    upsert=True
)

print("OK")
PYEOF
    
    if [ $? -eq 0 ]; then
        echo -e "  ${OK} База данных инициализирована"
    else
        echo -e "  ${WARN} Не удалось инициализировать БД (не критично)"
    fi
    
    # --- Nginx ---
    local SERVER_NAME="$DOMAIN"
    if ! echo "$DOMAIN" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
        SERVER_NAME="${DOMAIN} www.${DOMAIN}"
    fi
    
    cat > /etc/nginx/sites-available/taxi-ryadom << NGXEOF
server {
    listen 80;
    server_name ${SERVER_NAME};

    root ${INSTALL_DIR}/frontend/build;
    index index.html;

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket
    location /ws/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_read_timeout 86400;
    }

    # React SPA
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;

    client_max_body_size 10M;
}
NGXEOF
    
    rm -f /etc/nginx/sites-enabled/default
    ln -sf /etc/nginx/sites-available/taxi-ryadom /etc/nginx/sites-enabled/taxi-ryadom
    
    if nginx -t >> "$LOG_FILE" 2>&1; then
        systemctl restart nginx >> "$LOG_FILE" 2>&1
        echo -e "  ${OK} Nginx настроен и запущен"
    else
        echo -e "  ${FAIL} Ошибка конфигурации Nginx"
        nginx -t 2>&1 | tail -3
    fi
    
    # Файрвол
    if command -v ufw &>/dev/null; then
        ufw allow 22/tcp  >> "$LOG_FILE" 2>&1
        ufw allow 80/tcp  >> "$LOG_FILE" 2>&1
        ufw allow 443/tcp >> "$LOG_FILE" 2>&1
        if ! ufw status | grep -q "Status: active"; then
            echo "y" | ufw enable >> "$LOG_FILE" 2>&1
        fi
        echo -e "  ${OK} Файрвол (порты 22, 80, 443)"
    fi

    # --- Скрипт обновления ---
    cat > "${INSTALL_DIR}/update.sh" << 'UPDEOF'
#!/bin/bash
echo "=== Обновление такси-сервиса Рядом ==="
INSTALL_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$INSTALL_DIR/backend"
source venv/bin/activate
pip install -r requirements.txt
systemctl restart taxi-backend
cd "$INSTALL_DIR/frontend"
yarn install && yarn build
systemctl restart nginx
echo "=== Готово! ==="
UPDEOF
    chmod +x "${INSTALL_DIR}/update.sh"
    echo -e "  ${OK} Скрипт обновления: update.sh"
    
    # Автобэкап
    mkdir -p /opt/backups
    echo "0 3 * * * root mkdir -p /opt/backups && mongodump --db ${DB_NAME} --out /opt/backups/\$(date +\\%Y\\%m\\%d) 2>/dev/null && find /opt/backups -maxdepth 1 -mtime +14 -type d -exec rm -rf {} \\;" > /etc/cron.d/taxi-backup
    echo -e "  ${OK} Автобэкап БД (каждую ночь 3:00)"

    # ══════════════════════════════════════════════════════════
    #  ШАГ 7: Финальная проверка
    # ══════════════════════════════════════════════════════════
    print_step "Финальная проверка"
    
    local all_ok=true
    
    systemctl is-active --quiet mongod        && echo -e "  ${OK} MongoDB"        || { echo -e "  ${FAIL} MongoDB";        all_ok=false; }
    systemctl is-active --quiet taxi-backend   && echo -e "  ${OK} Бэкенд"         || { echo -e "  ${FAIL} Бэкенд";         all_ok=false; }
    systemctl is-active --quiet nginx          && echo -e "  ${OK} Nginx"           || { echo -e "  ${FAIL} Nginx";           all_ok=false; }
    
    sleep 2
    curl -s --max-time 5 http://localhost:8001/api/settings/public | grep -q "app_name" \
        && echo -e "  ${OK} API отвечает" \
        || { echo -e "  ${WARN} API не отвечает"; all_ok=false; }
    
    [ -f "${INSTALL_DIR}/frontend/build/index.html" ] \
        && echo -e "  ${OK} Фронтенд собран" \
        || { echo -e "  ${FAIL} Фронтенд не собран"; all_ok=false; }
    
    curl -s --max-time 5 "http://${DOMAIN}" | grep -q "html" \
        && echo -e "  ${OK} Сайт открывается" \
        || echo -e "  ${WARN} Сайт пока не отвечает (проверьте DNS)"
    
    # ══════════════════════════════════════════════════════════
    #  РЕЗУЛЬТАТ
    # ══════════════════════════════════════════════════════════
    echo ""
    
    if [ "$all_ok" = true ]; then
        echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║${NC}   ${BOLD}${GREEN}Установка завершена успешно!${NC}                          ${GREEN}║${NC}"
        echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
    else
        echo -e "${YELLOW}╔══════════════════════════════════════════════════════════╗${NC}"
        echo -e "${YELLOW}║${NC}   ${BOLD}${YELLOW}Установка завершена с предупреждениями${NC}                ${YELLOW}║${NC}"
        echo -e "${YELLOW}╚══════════════════════════════════════════════════════════╝${NC}"
    fi
    
    echo ""
    echo -e "  ${WHITE}Ваш сайт:${NC}"
    echo -e "  ${DIM}────────────────────────────────────────────────${NC}"
    echo -e "  Сайт:          ${BOLD}${PROTOCOL}://${DOMAIN}${NC}"
    echo -e "  Админ-панель:  ${BOLD}${PROTOCOL}://${DOMAIN}/admin/login${NC}"
    echo -e "  ${DIM}────────────────────────────────────────────────${NC}"
    echo ""
    echo -e "  ${WHITE}Данные для входа в админку:${NC}"
    echo -e "  Email:         ${BOLD}${ADMIN_EMAIL}${NC}"
    echo -e "  Пароль:        ${BOLD}${ADMIN_PASSWORD}${NC}"
    echo -e "  ${YELLOW}Смените пароль в админке после первого входа!${NC}"
    echo ""
    echo -e "  ${WHITE}Тестовый вход (пассажир/водитель):${NC}"
    echo -e "  Введите любой телефон, код: ${BOLD}1234${NC}"
    echo -e "  ${DIM}(отключается в Админка > Настройки > Тестовый режим)${NC}"
    echo ""
    echo -e "  ${WHITE}Полезные команды:${NC}"
    echo -e "  ${DIM}systemctl status taxi-backend${NC}   — статус"
    echo -e "  ${DIM}systemctl restart taxi-backend${NC}  — перезапуск"
    echo -e "  ${DIM}journalctl -u taxi-backend -f${NC}   — логи"
    echo -e "  ${DIM}bash ${INSTALL_DIR}/update.sh${NC}    — обновление"
    echo ""
    echo -e "  ${DIM}Лог установки: ${LOG_FILE}${NC}"
    echo ""
}

# ── Запуск ───────────────────────────────────────────────────
main "$@"
