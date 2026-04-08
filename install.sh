#!/bin/bash
# ============================================================
#  Инсталятор такси-сервиса «Рядом»
#  Запуск: sudo bash install.sh
# ============================================================

set -e

# ── Цвета и символы ─────────────────────────────────────────
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

# ── Переменные ──────────────────────────────────────────────
INSTALL_DIR=""
DOMAIN=""
ADMIN_EMAIL=""
ADMIN_PASSWORD=""
JWT_SECRET=""
USE_SSL="n"
STEP=0
TOTAL_STEPS=10
LOG_FILE="/tmp/taxi_install_$(date +%Y%m%d_%H%M%S).log"

# ── Функции ─────────────────────────────────────────────────

log() {
    echo "$@" >> "$LOG_FILE" 2>&1
}

print_header() {
    clear
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}${BOLD}       Инсталятор такси-сервиса «Рядом»              ${NC}${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}${DIM}       Версия 1.0 — Автоматическая установка           ${NC}${GREEN}║${NC}"
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

print_progress() {
    local current=$1
    local total=$2
    local width=40
    local pct=$((current * 100 / total))
    local filled=$((current * width / total))
    local empty=$((width - filled))
    
    printf "\r  ${CYAN}["
    printf "%${filled}s" | tr ' ' '='
    printf "%${empty}s" | tr ' ' ' '
    printf "] ${pct}%%${NC}"
    
    if [ "$current" -eq "$total" ]; then
        echo ""
    fi
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

ask_input() {
    local prompt="$1"
    local default="$2"
    local result
    
    if [ -n "$default" ]; then
        echo -ne "  ${prompt} ${DIM}[${default}]:${NC} "
    else
        echo -ne "  ${prompt}: "
    fi
    
    read -r result
    echo "${result:-$default}"
}

spinner() {
    local pid=$1
    local msg="$2"
    local chars='|/-\'
    local i=0
    
    while kill -0 "$pid" 2>/dev/null; do
        printf "\r  ${CYAN}%s${NC} %s" "${chars:$i:1}" "$msg"
        i=$(( (i+1) % 4 ))
        sleep 0.2
    done
    
    wait "$pid"
    local exit_code=$?
    printf "\r"
    return $exit_code
}

run_with_spinner() {
    local msg="$1"
    shift
    
    ("$@") >> "$LOG_FILE" 2>&1 &
    local pid=$!
    
    spinner "$pid" "$msg"
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo -e "  ${OK} ${msg}"
    else
        echo -e "  ${FAIL} ${msg}"
        echo -e "  ${DIM}Подробности в логе: ${LOG_FILE}${NC}"
    fi
    
    return $exit_code
}

check_root() {
    if [ "$(id -u)" -ne 0 ]; then
        echo -e "${FAIL} Этот скрипт нужно запускать от ${BOLD}root${NC}"
        echo -e "  Используйте: ${CYAN}sudo bash install.sh${NC}"
        exit 1
    fi
}

# ── Проверка зависимостей ───────────────────────────────────

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
        echo -e "  ${FAIL} ${name} ${RED}не установлен${NC}"
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
        echo -e "  ${WARN} ${name} ${YELLOW}(установлен, но не запущен)${NC}"
        return 1
    else
        echo -e "  ${FAIL} ${name} ${RED}не установлен${NC}"
        return 2
    fi
}

# ── Установщики ─────────────────────────────────────────────

install_nodejs() {
    echo -e "  ${ARROW} Установка Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >> "$LOG_FILE" 2>&1
    apt-get install -y nodejs >> "$LOG_FILE" 2>&1
    npm install -g yarn >> "$LOG_FILE" 2>&1
    echo -e "  ${OK} Node.js установлен"
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
    
    apt-get update >> "$LOG_FILE" 2>&1
    
    if ! apt-get install -y mongodb-org >> "$LOG_FILE" 2>&1; then
        echo -e "  ${WARN} Не удалось установить из репозитория (возможно блокировка)"
        echo -e "  ${ARROW} Пробуем репозиторий focal..."
        
        echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list >> "$LOG_FILE"
        apt-get update >> "$LOG_FILE" 2>&1
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
    echo -e "  ${OK} Nginx установлен и запущен"
}

install_certbot() {
    echo -e "  ${ARROW} Установка Certbot..."
    apt-get install -y certbot python3-certbot-nginx >> "$LOG_FILE" 2>&1
    echo -e "  ${OK} Certbot установлен"
}

# ════════════════════════════════════════════════════════════
#  ОСНОВНОЙ ПОТОК УСТАНОВКИ
# ════════════════════════════════════════════════════════════

main() {
    check_root
    print_header
    
    echo -e "  ${INFO} Лог установки: ${DIM}${LOG_FILE}${NC}"
    echo ""
    echo -e "  Этот инсталятор поможет вам настроить такси-сервис «Рядом»"
    echo -e "  на вашем VDS сервере шаг за шагом."
    echo ""
    
    if ! ask_yes_no "Начать установку?"; then
        echo -e "\n  Установка отменена."
        exit 0
    fi

    # ── ШАГ 1: Определение директории проекта ───────────────
    print_step "Определение директории проекта"
    
    # Попробовать определить автоматически
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    
    if [ -f "${SCRIPT_DIR}/backend/server.py" ] && [ -f "${SCRIPT_DIR}/frontend/package.json" ]; then
        echo -e "  ${OK} Проект найден в: ${BOLD}${SCRIPT_DIR}${NC}"
        INSTALL_DIR="$SCRIPT_DIR"
    elif [ -f "/opt/taxi-app/backend/server.py" ]; then
        echo -e "  ${OK} Проект найден в: ${BOLD}/opt/taxi-app${NC}"
        INSTALL_DIR="/opt/taxi-app"
    else
        echo -e "  ${WARN} Проект не найден автоматически"
        INSTALL_DIR=$(ask_input "Путь к папке проекта" "/opt/taxi-app")
    fi
    
    # Проверка файлов
    local files_ok=true
    
    if [ -f "${INSTALL_DIR}/backend/server.py" ]; then
        echo -e "  ${OK} backend/server.py"
    else
        echo -e "  ${FAIL} backend/server.py ${RED}не найден${NC}"
        files_ok=false
    fi
    
    if [ -f "${INSTALL_DIR}/backend/requirements.txt" ]; then
        echo -e "  ${OK} backend/requirements.txt"
    else
        echo -e "  ${FAIL} backend/requirements.txt ${RED}не найден${NC}"
        files_ok=false
    fi
    
    if [ -f "${INSTALL_DIR}/frontend/package.json" ]; then
        echo -e "  ${OK} frontend/package.json"
    else
        echo -e "  ${FAIL} frontend/package.json ${RED}не найден${NC}"
        files_ok=false
    fi
    
    if [ "$files_ok" = false ]; then
        echo ""
        echo -e "  ${FAIL} Не все файлы проекта на месте."
        echo -e "  Загрузите папки ${BOLD}backend${NC} и ${BOLD}frontend${NC} в ${INSTALL_DIR}"
        echo -e "  и запустите инсталятор заново."
        exit 1
    fi
    
    echo ""
    echo -e "  ${OK} Все файлы проекта на месте"
    
    # ── ШАГ 2: Проверка зависимостей ────────────────────────
    print_step "Проверка зависимостей"
    
    echo -e "  ${WHITE}Обновление списка пакетов...${NC}"
    apt-get update -qq >> "$LOG_FILE" 2>&1
    
    # Базовые утилиты
    apt-get install -y curl wget git unzip lsb-release gnupg software-properties-common >> "$LOG_FILE" 2>&1
    
    echo ""
    echo -e "  ${WHITE}Проверка компонентов:${NC}"
    echo ""
    
    local need_node=false
    local need_python=false
    local need_mongo=false
    local need_nginx=false
    
    # Node.js
    if ! check_dependency "Node.js" "node" "node --version"; then
        need_node=true
    fi
    
    # Yarn
    if ! check_dependency "Yarn" "yarn" "yarn --version"; then
        need_node=true  # Yarn ставится вместе с Node
    fi
    
    # Python 3
    if ! check_dependency "Python 3" "python3" "python3 --version"; then
        need_python=true
    fi
    
    # pip
    if ! check_dependency "pip3" "pip3" "pip3 --version"; then
        need_python=true
    fi
    
    # MongoDB
    local mongo_status
    check_service "MongoDB" "mongod"
    mongo_status=$?
    if [ $mongo_status -eq 2 ]; then
        need_mongo=true
    elif [ $mongo_status -eq 1 ]; then
        echo -e "  ${ARROW} Запуск MongoDB..."
        systemctl start mongod >> "$LOG_FILE" 2>&1
        echo -e "  ${OK} MongoDB запущен"
    fi
    
    # Nginx
    local nginx_status
    check_service "Nginx" "nginx"
    nginx_status=$?
    if [ $nginx_status -eq 2 ]; then
        need_nginx=true
    elif [ $nginx_status -eq 1 ]; then
        echo -e "  ${ARROW} Запуск Nginx..."
        systemctl start nginx >> "$LOG_FILE" 2>&1
        echo -e "  ${OK} Nginx запущен"
    fi
    
    # Certbot
    check_dependency "Certbot" "certbot" "certbot --version" || true
    
    # ── ШАГ 3: Установка недостающего ПО ────────────────────
    
    if $need_node || $need_python || $need_mongo || $need_nginx; then
        print_step "Установка недостающих компонентов"
        
        echo -e "  ${WHITE}Нужно установить:${NC}"
        $need_node && echo -e "    - Node.js 20 + Yarn"
        $need_python && echo -e "    - Python 3 + pip"
        $need_mongo && echo -e "    - MongoDB 7.0"
        $need_nginx && echo -e "    - Nginx"
        echo ""
        
        if ! ask_yes_no "Установить всё автоматически?"; then
            echo -e "  ${WARN} Установите компоненты вручную и запустите инсталятор заново."
            exit 1
        fi
        
        echo ""
        
        if $need_node; then
            install_nodejs
        fi
        
        if $need_python; then
            install_python
        fi
        
        if $need_mongo; then
            install_mongodb
        fi
        
        if $need_nginx; then
            install_nginx
        fi
        
        echo ""
        echo -e "  ${OK} Все компоненты установлены"
    else
        STEP=$((STEP + 1))  # Пропускаем шаг
        echo ""
        echo -e "  ${OK} Все компоненты уже установлены!"
    fi

    # ── ШАГ 4: Сбор настроек ────────────────────────────────
    print_step "Настройка параметров"
    
    echo -e "  ${WHITE}Укажите параметры для вашего сервиса:${NC}"
    echo ""
    
    # Домен
    local server_ip
    server_ip=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
    
    DOMAIN=$(ask_input "Домен (или IP-адрес)" "$server_ip")
    
    # Определить протокол
    local PROTOCOL="http"
    if echo "$DOMAIN" | grep -qvE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
        if ask_yes_no "Настроить HTTPS (SSL) для ${DOMAIN}?" "y"; then
            USE_SSL="y"
            PROTOCOL="https"
        fi
    else
        echo -e "  ${DIM}(SSL доступен только для доменов, не для IP)${NC}"
    fi
    
    echo ""
    
    # Админ
    ADMIN_EMAIL=$(ask_input "Email администратора" "admin@${DOMAIN}")
    
    while true; do
        echo -ne "  Пароль администратора ${DIM}(мин. 6 символов)${NC}: "
        read -rs ADMIN_PASSWORD
        echo ""
        if [ ${#ADMIN_PASSWORD} -ge 6 ]; then
            break
        fi
        echo -e "  ${WARN} Пароль слишком короткий"
    done
    
    # JWT Secret
    JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || openssl rand -hex 32)
    echo -e "  ${OK} JWT-ключ сгенерирован"
    
    echo ""
    echo -e "  ${WHITE}Итого:${NC}"
    echo -e "  ${DIM}────────────────────────────────${NC}"
    echo -e "  Домен:   ${BOLD}${PROTOCOL}://${DOMAIN}${NC}"
    echo -e "  Админ:   ${BOLD}${ADMIN_EMAIL}${NC}"
    echo -e "  Проект:  ${BOLD}${INSTALL_DIR}${NC}"
    echo -e "  ${DIM}────────────────────────────────${NC}"
    echo ""
    
    if ! ask_yes_no "Всё верно? Продолжить?"; then
        echo -e "  Запустите инсталятор заново для изменения настроек."
        exit 0
    fi

    # ── ШАГ 5: Настройка бэкенда ────────────────────────────
    print_step "Настройка бэкенда (Python)"
    
    cd "${INSTALL_DIR}/backend"
    
    # Виртуальное окружение
    if [ ! -d "venv" ]; then
        echo -e "  ${ARROW} Создание виртуального окружения..."
        python3 -m venv venv >> "$LOG_FILE" 2>&1
        echo -e "  ${OK} Виртуальное окружение создано"
    else
        echo -e "  ${OK} Виртуальное окружение уже существует"
    fi
    
    # Активация и установка зависимостей
    echo -e "  ${ARROW} Установка Python-зависимостей..."
    source venv/bin/activate
    pip install --upgrade pip >> "$LOG_FILE" 2>&1
    pip install -r requirements.txt >> "$LOG_FILE" 2>&1
    echo -e "  ${OK} Зависимости установлены"
    
    # Создание .env
    echo -e "  ${ARROW} Создание файла конфигурации..."
    
    local CORS_ORIGINS="${PROTOCOL}://${DOMAIN}"
    if echo "$DOMAIN" | grep -qvE '^[0-9]+\.[0-9]+'; then
        CORS_ORIGINS="${PROTOCOL}://${DOMAIN},${PROTOCOL}://www.${DOMAIN}"
    fi
    
    cat > .env << ENVEOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=taxi_production
JWT_SECRET=${JWT_SECRET}
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
CORS_ORIGINS=${CORS_ORIGINS}
ENVEOF
    
    chmod 600 .env
    echo -e "  ${OK} Файл .env создан ${DIM}(права 600)${NC}"
    
    # Создание папки uploads
    mkdir -p uploads
    echo -e "  ${OK} Папка uploads создана"

    # ── ШАГ 6: Настройка фронтенда ──────────────────────────
    print_step "Сборка фронтенда (React)"
    
    cd "${INSTALL_DIR}/frontend"
    
    # .env
    cat > .env << ENVEOF
REACT_APP_BACKEND_URL=${PROTOCOL}://${DOMAIN}
ENVEOF
    
    echo -e "  ${OK} Файл .env фронтенда создан"
    
    # Установка зависимостей
    echo -e "  ${ARROW} Установка JS-зависимостей (yarn install)..."
    echo -e "  ${DIM}  Это может занять 2-5 минут...${NC}"
    
    yarn install --production=false >> "$LOG_FILE" 2>&1
    echo -e "  ${OK} Зависимости установлены"
    
    # Сборка
    echo -e "  ${ARROW} Сборка приложения (yarn build)..."
    echo -e "  ${DIM}  Это может занять 1-3 минуты...${NC}"
    
    yarn build >> "$LOG_FILE" 2>&1
    echo -e "  ${OK} Фронтенд собран"
    
    # Проверка
    if [ -f "build/index.html" ]; then
        echo -e "  ${OK} Файл build/index.html существует"
    else
        echo -e "  ${FAIL} Сборка не удалась! Проверьте лог: ${LOG_FILE}"
        exit 1
    fi

    # ── ШАГ 7: Создание systemd-сервиса ─────────────────────
    print_step "Создание сервиса бэкенда"
    
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
    systemctl start taxi-backend >> "$LOG_FILE" 2>&1
    systemctl enable taxi-backend >> "$LOG_FILE" 2>&1
    
    # Проверка
    sleep 3
    if systemctl is-active --quiet taxi-backend; then
        echo -e "  ${OK} Бэкенд запущен и работает"
    else
        echo -e "  ${FAIL} Бэкенд не запустился!"
        echo -e "  ${DIM}Проверьте: journalctl -u taxi-backend -n 30${NC}"
        echo ""
        journalctl -u taxi-backend -n 10 --no-pager 2>/dev/null || true
    fi
    
    # Проверка API
    sleep 2
    if curl -s --max-time 5 http://localhost:8001/api/settings/public | grep -q "app_name"; then
        echo -e "  ${OK} API отвечает корректно"
    else
        echo -e "  ${WARN} API пока не отвечает (возможно, ещё запускается)"
    fi

    # ── ШАГ 8: Настройка Nginx ──────────────────────────────
    print_step "Настройка веб-сервера (Nginx)"
    
    local SERVER_NAME="$DOMAIN"
    if echo "$DOMAIN" | grep -qvE '^[0-9]+\.[0-9]+'; then
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
    
    # Активация
    rm -f /etc/nginx/sites-enabled/default
    ln -sf /etc/nginx/sites-available/taxi-ryadom /etc/nginx/sites-enabled/taxi-ryadom
    
    # Проверка конфига
    if nginx -t >> "$LOG_FILE" 2>&1; then
        echo -e "  ${OK} Конфигурация Nginx корректна"
        systemctl restart nginx >> "$LOG_FILE" 2>&1
        echo -e "  ${OK} Nginx перезапущен"
    else
        echo -e "  ${FAIL} Ошибка в конфигурации Nginx!"
        nginx -t 2>&1 | tail -5
    fi

    # ── ШАГ 9: SSL-сертификат ───────────────────────────────
    print_step "SSL-сертификат (HTTPS)"
    
    if [ "$USE_SSL" = "y" ]; then
        # Установка certbot если нет
        if ! command -v certbot &>/dev/null; then
            install_certbot
        fi
        
        echo -e "  ${ARROW} Выпуск SSL-сертификата для ${DOMAIN}..."
        echo -e "  ${DIM}  Убедитесь что DNS домена указывает на этот сервер${NC}"
        echo ""
        
        # Проверка DNS
        local resolved_ip
        resolved_ip=$(dig +short "$DOMAIN" 2>/dev/null | head -1)
        
        if [ -n "$resolved_ip" ]; then
            echo -e "  ${OK} DNS: ${DOMAIN} -> ${resolved_ip}"
        else
            echo -e "  ${WARN} Не удалось проверить DNS для ${DOMAIN}"
        fi
        
        echo ""
        
        if ask_yes_no "Выпустить SSL-сертификат сейчас?"; then
            local certbot_args="--nginx -d ${DOMAIN} --non-interactive --agree-tos --email ${ADMIN_EMAIL}"
            
            # www subdomain
            if echo "$DOMAIN" | grep -qvE '^[0-9]+\.[0-9]+'; then
                certbot_args="$certbot_args -d www.${DOMAIN}"
            fi
            
            if certbot $certbot_args >> "$LOG_FILE" 2>&1; then
                echo -e "  ${OK} SSL-сертификат установлен!"
                echo -e "  ${OK} Сайт доступен по ${BOLD}https://${DOMAIN}${NC}"
            else
                echo -e "  ${WARN} Не удалось выпустить сертификат"
                echo -e "  ${DIM}  Возможно DNS ещё не обновился. Попробуйте позже:${NC}"
                echo -e "  ${DIM}  certbot --nginx -d ${DOMAIN}${NC}"
            fi
        else
            echo -e "  ${INFO} SSL пропущен. Для установки позже:"
            echo -e "  ${DIM}  certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}${NC}"
        fi
    else
        echo -e "  ${INFO} SSL не требуется (используется IP-адрес)"
        echo -e "  ${DIM}  Для HTTPS подключите домен и запустите:${NC}"
        echo -e "  ${DIM}  certbot --nginx -d вашдомен.ru${NC}"
    fi

    # ── ШАГ 10: Файрвол и финализация ───────────────────────
    print_step "Финализация"
    
    # Файрвол
    echo -e "  ${ARROW} Настройка файрвола..."
    if command -v ufw &>/dev/null; then
        ufw allow 22/tcp >> "$LOG_FILE" 2>&1
        ufw allow 80/tcp >> "$LOG_FILE" 2>&1
        ufw allow 443/tcp >> "$LOG_FILE" 2>&1
        
        if ! ufw status | grep -q "Status: active"; then
            echo "y" | ufw enable >> "$LOG_FILE" 2>&1
        fi
        echo -e "  ${OK} Файрвол настроен (порты 22, 80, 443)"
    else
        echo -e "  ${DIM}  UFW не установлен, пропуск${NC}"
    fi
    
    # Создание скрипта обновления
    cat > "${INSTALL_DIR}/update.sh" << 'UPDEOF'
#!/bin/bash
echo "=== Обновление такси-сервиса Рядом ==="
INSTALL_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "1. Обновление бэкенда..."
cd "$INSTALL_DIR/backend"
source venv/bin/activate
pip install -r requirements.txt
systemctl restart taxi-backend

echo "2. Сборка фронтенда..."
cd "$INSTALL_DIR/frontend"
yarn install
yarn build

echo "3. Перезапуск Nginx..."
systemctl restart nginx

echo "=== Обновление завершено! ==="
UPDEOF
    chmod +x "${INSTALL_DIR}/update.sh"
    echo -e "  ${OK} Скрипт обновления создан: ${INSTALL_DIR}/update.sh"
    
    # Автобэкап
    mkdir -p /opt/backups
    cat > /etc/cron.d/taxi-backup << 'CRONEOF'
0 3 * * * root mkdir -p /opt/backups && mongodump --db taxi_production --out /opt/backups/$(date +\%Y\%m\%d) 2>/dev/null && find /opt/backups -maxdepth 1 -mtime +14 -type d -exec rm -rf {} \;
CRONEOF
    echo -e "  ${OK} Автобэкап БД настроен (3:00 каждую ночь)"
    
    # ── ИТОГОВАЯ ПРОВЕРКА ───────────────────────────────────
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}${BOLD}       Финальная проверка                               ${NC}${GREEN}║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    local all_ok=true
    
    # MongoDB
    if systemctl is-active --quiet mongod; then
        echo -e "  ${OK} MongoDB работает"
    else
        echo -e "  ${FAIL} MongoDB не работает"
        all_ok=false
    fi
    
    # Backend
    if systemctl is-active --quiet taxi-backend; then
        echo -e "  ${OK} Бэкенд работает"
    else
        echo -e "  ${FAIL} Бэкенд не работает"
        all_ok=false
    fi
    
    # Nginx
    if systemctl is-active --quiet nginx; then
        echo -e "  ${OK} Nginx работает"
    else
        echo -e "  ${FAIL} Nginx не работает"
        all_ok=false
    fi
    
    # API check
    sleep 2
    if curl -s --max-time 5 http://localhost:8001/api/settings/public | grep -q "app_name"; then
        echo -e "  ${OK} API отвечает"
    else
        echo -e "  ${WARN} API не отвечает (может потребоваться пара секунд)"
        all_ok=false
    fi
    
    # Frontend check
    if [ -f "${INSTALL_DIR}/frontend/build/index.html" ]; then
        echo -e "  ${OK} Фронтенд собран"
    else
        echo -e "  ${FAIL} Фронтенд не собран"
        all_ok=false
    fi
    
    # Website check
    if curl -s --max-time 5 "http://${DOMAIN}" | grep -q "html"; then
        echo -e "  ${OK} Сайт открывается"
    else
        echo -e "  ${WARN} Сайт пока не отвечает (проверьте DNS)"
    fi
    
    # ── РЕЗУЛЬТАТ ───────────────────────────────────────────
    echo ""
    
    if [ "$all_ok" = true ]; then
        echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║${NC}                                                          ${GREEN}║${NC}"
        echo -e "${GREEN}║${NC}   ${BOLD}${GREEN}Установка завершена успешно!${NC}                          ${GREEN}║${NC}"
        echo -e "${GREEN}║${NC}                                                          ${GREEN}║${NC}"
        echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
    else
        echo -e "${YELLOW}╔══════════════════════════════════════════════════════════╗${NC}"
        echo -e "${YELLOW}║${NC}                                                          ${YELLOW}║${NC}"
        echo -e "${YELLOW}║${NC}   ${BOLD}${YELLOW}Установка завершена с предупреждениями${NC}                ${YELLOW}║${NC}"
        echo -e "${YELLOW}║${NC}                                                          ${YELLOW}║${NC}"
        echo -e "${YELLOW}╚══════════════════════════════════════════════════════════╝${NC}"
    fi
    
    echo ""
    echo -e "  ${WHITE}Ваши данные:${NC}"
    echo -e "  ${DIM}────────────────────────────────────────────────${NC}"
    echo -e "  Сайт:         ${BOLD}${PROTOCOL}://${DOMAIN}${NC}"
    echo -e "  Админ-панель: ${BOLD}${PROTOCOL}://${DOMAIN}/admin/login${NC}"
    echo -e "  Email админа: ${BOLD}${ADMIN_EMAIL}${NC}"
    echo -e "  Пароль админа:${BOLD} (тот что вы ввели)${NC}"
    echo -e "  Тестовый код: ${BOLD}1234${NC}"
    echo -e "  ${DIM}────────────────────────────────────────────────${NC}"
    echo ""
    echo -e "  ${WHITE}Быстрый тест:${NC}"
    echo -e "  1. Откройте ${PROTOCOL}://${DOMAIN}"
    echo -e "  2. Нажмите «Заказчик»"
    echo -e "  3. Введите любой телефон, примите условия"
    echo -e "  4. Введите код ${BOLD}1234${NC}"
    echo -e "  5. Придумайте PIN-код"
    echo ""
    echo -e "  ${WHITE}Полезные команды:${NC}"
    echo -e "  ${DIM}systemctl status taxi-backend${NC}  — статус бэкенда"
    echo -e "  ${DIM}systemctl restart taxi-backend${NC} — перезапуск бэкенда"
    echo -e "  ${DIM}journalctl -u taxi-backend -f${NC}  — логи бэкенда"
    echo -e "  ${DIM}bash ${INSTALL_DIR}/update.sh${NC}   — обновление сайта"
    echo ""
    echo -e "  ${DIM}Лог установки: ${LOG_FILE}${NC}"
    echo ""
}

# ── Запуск ──────────────────────────────────────────────────
main "$@"
