# Руководство по деплою на VDS Timeweb

## Требования

- VDS сервер Timeweb (Ubuntu 22.04+)
- Минимум 1 ГБ RAM, 1 CPU
- Доменное имя (опционально, но рекомендуется)

---

## Шаг 1: Подключение к серверу

```bash
ssh root@ВАШ_IP_АДРЕС
```

---

## Шаг 2: Обновление системы и установка зависимостей

```bash
apt update && apt upgrade -y
apt install -y curl git nginx certbot python3-certbot-nginx
```

### Установка Node.js 20:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g yarn
```

### Установка Python 3.11+:
```bash
apt install -y python3 python3-pip python3-venv
```

### Установка MongoDB:
```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt update
apt install -y mongodb-org
systemctl start mongod
systemctl enable mongod
```

Проверка:
```bash
mongosh --eval "db.runCommand({ping:1})"
```

---

## Шаг 3: Загрузка проекта

### Вариант 1 — Git:
```bash
cd /opt
git clone ВАШ_РЕПОЗИТОРИЙ taxi-app
cd taxi-app
```

### Вариант 2 — Загрузка файлов через SCP:
```bash
scp -r ./backend ./frontend root@ВАШ_IP:/opt/taxi-app/
```

---

## Шаг 4: Настройка бэкенда

```bash
cd /opt/taxi-app/backend

# Создание виртуального окружения
python3 -m venv venv
source venv/bin/activate

# Установка зависимостей
pip install -r requirements.txt
```

### Создание файла .env:
```bash
cat > .env << 'EOF'
MONGO_URL=mongodb://localhost:27017
DB_NAME=taxi_production
JWT_SECRET=СГЕНЕРИРУЙТЕ_ДЛИННЫЙ_СЛУЧАЙНЫЙ_КЛЮЧ
ADMIN_EMAIL=admin@ваш-домен.ru
ADMIN_PASSWORD=НАДЕЖНЫЙ_ПАРОЛЬ_АДМИНА
CORS_ORIGINS=https://ваш-домен.ru,https://www.ваш-домен.ru
EOF
```

Сгенерировать JWT_SECRET:
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

---

## Шаг 5: Настройка фронтенда

```bash
cd /opt/taxi-app/frontend

# Установка зависимостей
yarn install

# Создание файла .env
cat > .env << 'EOF'
REACT_APP_BACKEND_URL=https://ваш-домен.ru
EOF

# Сборка фронтенда
yarn build
```

---

## Шаг 6: Настройка systemd для бэкенда

```bash
cat > /etc/systemd/system/taxi-backend.service << 'EOF'
[Unit]
Description=Taxi Backend API
After=network.target mongod.service

[Service]
User=root
WorkingDirectory=/opt/taxi-app/backend
Environment=PATH=/opt/taxi-app/backend/venv/bin:/usr/bin
ExecStart=/opt/taxi-app/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl start taxi-backend
systemctl enable taxi-backend
```

Проверка:
```bash
systemctl status taxi-backend
curl http://localhost:8001/api/settings/public
```

---

## Шаг 7: Настройка Nginx

```bash
cat > /etc/nginx/sites-available/taxi << 'EOF'
server {
    listen 80;
    server_name ваш-домен.ru www.ваш-домен.ru;

    # Фронтенд (статические файлы)
    root /opt/taxi-app/frontend/build;
    index index.html;

    # API проксирование
    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket проксирование
    location /ws/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }

    # React SPA — все остальные запросы
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Оптимизация
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    
    client_max_body_size 10M;
}
EOF

# Активация конфигурации
ln -sf /etc/nginx/sites-available/taxi /etc/nginx/sites-enabled/taxi
rm -f /etc/nginx/sites-enabled/default

# Проверка и перезапуск
nginx -t
systemctl restart nginx
```

---

## Шаг 8: SSL сертификат (HTTPS)

```bash
certbot --nginx -d ваш-домен.ru -d www.ваш-домен.ru
```

Автообновление сертификата:
```bash
certbot renew --dry-run
```

---

## Шаг 9: Настройка файрвола

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

---

## Шаг 10: Проверка работоспособности

1. Откройте `https://ваш-домен.ru` в браузере
2. Должна загрузиться страница выбора роли (Заказчик / Исполнитель)
3. Перейдите в `https://ваш-домен.ru/admin/login`
4. Войдите с email/паролем из .env файла бэкенда

---

## Обновление приложения

```bash
cd /opt/taxi-app

# Получить последние изменения
git pull

# Обновить бэкенд
cd backend
source venv/bin/activate
pip install -r requirements.txt
systemctl restart taxi-backend

# Обновить фронтенд
cd ../frontend
yarn install
yarn build

# Nginx перечитает статику автоматически
```

---

## Полезные команды

| Команда | Описание |
|---------|----------|
| `systemctl status taxi-backend` | Статус бэкенда |
| `journalctl -u taxi-backend -f` | Логи бэкенда (live) |
| `systemctl restart taxi-backend` | Перезапуск бэкенда |
| `systemctl restart nginx` | Перезапуск Nginx |
| `mongosh taxi_production` | Подключение к БД |
| `certbot renew` | Обновление SSL |

---

## Мониторинг БД

```bash
mongosh taxi_production --eval "
  print('Пользователей:', db.users.countDocuments());
  print('Заказов:', db.orders.countDocuments());
  print('Водителей онлайн:', db.users.countDocuments({role:'driver', is_online:true}));
"
```

---

## Бэкап базы данных

```bash
# Создание бэкапа
mongodump --db taxi_production --out /opt/backups/$(date +%Y%m%d)

# Восстановление
mongorestore --db taxi_production /opt/backups/ДАТА/taxi_production/
```

Автоматический ежедневный бэкап:
```bash
cat > /etc/cron.d/taxi-backup << 'EOF'
0 3 * * * root mongodump --db taxi_production --out /opt/backups/$(date +\%Y\%m\%d) && find /opt/backups -mtime +7 -delete
EOF
```

---

## Возможные проблемы

### Бэкенд не запускается
```bash
journalctl -u taxi-backend -n 50
# Проверьте .env файл и установку зависимостей
```

### MongoDB не запускается
```bash
systemctl status mongod
journalctl -u mongod -n 50
```

### Nginx ошибка 502
```bash
# Бэкенд не запущен или неправильный порт
curl http://localhost:8001/api/settings/public
systemctl restart taxi-backend
```

### Проблемы с WebSocket
Убедитесь что в Nginx настроен проброс WebSocket (Upgrade headers).
