# Установка такси-сервиса «Рядом» на VDS Timeweb

## Пошаговое руководство для новичков

> Это руководство написано максимально подробно. Даже если вы никогда не работали с серверами — просто следуйте шагам по порядку, копируйте команды и вставляйте в терминал.

---

## Содержание

1. [Покупка VDS на Timeweb](#1-покупка-vds-на-timeweb)
2. [Подключение к серверу](#2-подключение-к-серверу)
3. [Настройка сервера](#3-настройка-сервера)
4. [Установка Node.js](#4-установка-nodejs)
5. [Установка Python](#5-установка-python)
6. [Установка MongoDB](#6-установка-mongodb)
7. [Установка Nginx](#7-установка-nginx)
8. [Загрузка проекта на сервер](#8-загрузка-проекта-на-сервер)
9. [Настройка бэкенда](#9-настройка-бэкенда)
10. [Настройка фронтенда](#10-настройка-фронтенда)
11. [Запуск бэкенда как сервиса](#11-запуск-бэкенда-как-сервиса)
12. [Настройка Nginx](#12-настройка-nginx-веб-сервера)
13. [Подключение домена](#13-подключение-домена)
14. [SSL-сертификат (HTTPS)](#14-ssl-сертификат-https)
15. [Настройка файрвола](#15-настройка-файрвола)
16. [Создание админа](#16-создание-администратора)
17. [Проверка работоспособности](#17-проверка-работоспособности)
18. [Обновление сайта](#18-обновление-сайта)
19. [Бэкапы](#19-бэкапы-базы-данных)
20. [Решение проблем](#20-решение-проблем)

---

## 1. Покупка VDS на Timeweb

### Шаг 1: Зайдите на сайт Timeweb

Откройте [https://timeweb.cloud/vds](https://timeweb.cloud/vds)

### Шаг 2: Выберите тариф

**Минимальные требования:**
- **CPU:** 1 ядро
- **RAM:** 2 ГБ (рекомендуется, 1 ГБ — минимум)
- **Диск:** 20 ГБ SSD
- **ОС:** Ubuntu 22.04 LTS

> Рекомендую тариф «Start» или «Optimum» — этого хватит для начала.

### Шаг 3: При создании сервера

1. Выберите **Ubuntu 22.04**
2. Выберите регион ближе к вашим пользователям (Москва / Санкт-Петербург)
3. Задайте **пароль root** (запишите его — он понадобится!)
4. Нажмите «Создать»

### Шаг 4: Запишите IP-адрес

После создания сервера вы увидите **IP-адрес** в панели управления, например:
```
185.104.XXX.XXX
```
Запишите его — это адрес вашего сервера.

---

## 2. Подключение к серверу

### На Windows:

1. Скачайте программу **PuTTY**: [https://www.putty.org/](https://www.putty.org/)
2. Откройте PuTTY
3. В поле **Host Name** введите IP вашего сервера
4. Нажмите **Open**
5. В чёрном окне введите: `root`
6. Введите пароль (при вводе пароля символы НЕ отображаются — это нормально)

### На Mac / Linux:

Откройте **Терминал** и введите:

```bash
ssh root@185.104.XXX.XXX
```

Замените `185.104.XXX.XXX` на ваш IP-адрес. Введите пароль.

### Если подключились успешно:

Вы увидите что-то вроде:
```
root@server:~#
```

Это значит вы внутри сервера! Все следующие команды вводим здесь.

---

## 3. Настройка сервера

Копируйте каждую команду и вставляйте в терминал. После каждой команды нажимайте **Enter**.

### Обновление системы:

```bash
apt update && apt upgrade -y
```

> Это обновит все пакеты. Занимает 1-3 минуты. Если спросит что-то — нажимайте Enter.

### Установка базовых утилит:

```bash
apt install -y curl wget git unzip software-properties-common
```

---

## 4. Установка Node.js

Node.js нужен для сборки фронтенда (интерфейса сайта).

### Шаг 1: Добавьте репозиторий Node.js 20:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
```

### Шаг 2: Установите Node.js:

```bash
apt install -y nodejs
```

### Шаг 3: Установите Yarn (менеджер пакетов):

```bash
npm install -g yarn
```

### Шаг 4: Проверьте установку:

```bash
node --version
yarn --version
```

Должно показать что-то вроде:
```
v20.x.x
1.22.x
```

Если видите версии — всё установлено правильно!

---

## 5. Установка Python

Python нужен для бэкенда (серверной части).

### Шаг 1: Установите Python 3 и pip:

```bash
apt install -y python3 python3-pip python3-venv python3-dev
```

### Шаг 2: Проверьте:

```bash
python3 --version
pip3 --version
```

Должно показать Python 3.10+ и pip.

---

## 6. Установка MongoDB

MongoDB — это база данных, где хранятся пользователи, заказы и настройки.

### Шаг 1: Добавьте ключ MongoDB:

```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
```

### Шаг 2: Добавьте репозиторий:

```bash
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
```

### Шаг 3: Установите MongoDB:

```bash
apt update
apt install -y mongodb-org
```

### Шаг 4: Запустите MongoDB:

```bash
systemctl start mongod
systemctl enable mongod
```

> `enable` означает что MongoDB будет автоматически запускаться при перезагрузке сервера.

### Шаг 5: Проверьте что работает:

```bash
systemctl status mongod
```

Должно показать **active (running)** зелёным цветом. Нажмите `q` чтобы выйти.

Дополнительная проверка:
```bash
mongosh --eval "db.runCommand({ping:1})"
```

Если видите `{ ok: 1 }` — MongoDB работает!

---

## 7. Установка Nginx

Nginx — это веб-сервер, который будет показывать ваш сайт пользователям.

```bash
apt install -y nginx
```

### Проверьте:

```bash
systemctl status nginx
```

Должен быть **active (running)**.

Откройте в браузере `http://ВАШ_IP` — должна появиться стандартная страница Nginx "Welcome to nginx!".

---

## 8. Загрузка проекта на сервер

### Вариант А: Через GitHub (рекомендуется)

Если ваш код на GitHub:

```bash
cd /opt
git clone https://github.com/ВАШ_ЛОГИН/НАЗВАНИЕ_РЕПОЗИТОРИЯ.git taxi-app
cd taxi-app
```

### Вариант Б: Загрузка файлов вручную (через SCP)

Если код только на вашем компьютере:

**На Windows** используйте WinSCP: [https://winscp.net/](https://winscp.net/)

1. Скачайте и установите WinSCP
2. Подключитесь к серверу (IP, логин root, пароль)
3. На сервере перейдите в `/opt/`
4. Создайте папку `taxi-app`
5. Перетащите папки `backend` и `frontend` в `/opt/taxi-app/`

**На Mac/Linux:**

```bash
# Выполните ЭТУ команду НА ВАШЕМ КОМПЬЮТЕРЕ (не на сервере!)
scp -r ./backend ./frontend root@185.104.XXX.XXX:/opt/taxi-app/
```

### Проверьте что файлы на месте:

```bash
ls /opt/taxi-app/
```

Должны быть папки `backend` и `frontend`.

```bash
ls /opt/taxi-app/backend/
ls /opt/taxi-app/frontend/
```

Убедитесь что видите `server.py` в backend и `package.json` в frontend.

---

## 9. Настройка бэкенда

### Шаг 1: Перейдите в папку бэкенда:

```bash
cd /opt/taxi-app/backend
```

### Шаг 2: Создайте виртуальное окружение Python:

```bash
python3 -m venv venv
```

### Шаг 3: Активируйте его:

```bash
source venv/bin/activate
```

> Вы увидите `(venv)` в начале строки — это значит окружение активировано.

### Шаг 4: Установите зависимости:

```bash
pip install -r requirements.txt
```

> Это может занять 2-5 минут. Подождите пока всё установится.

### Шаг 5: Создайте файл настроек (.env):

Сначала сгенерируйте секретный ключ:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Скопируйте длинную строку из букв и цифр (это ваш JWT_SECRET).

Теперь создайте файл:

```bash
nano /opt/taxi-app/backend/.env
```

Вставьте следующий текст (замените значения на свои):

```
MONGO_URL=mongodb://localhost:27017
DB_NAME=taxi_production
JWT_SECRET=ВСТАВЬТЕ_СЮДА_ДЛИННУЮ_СТРОКУ_КОТОРУЮ_СГЕНЕРИРОВАЛИ
ADMIN_EMAIL=admin@вашдомен.ru
ADMIN_PASSWORD=НадёжныйПароль123!
CORS_ORIGINS=https://вашдомен.ru,https://www.вашдомен.ru
```

> **Как сохранить в nano:** нажмите `Ctrl+X`, потом `Y`, потом `Enter`

**ВАЖНО:** Замените:
- `ВСТАВЬТЕ_СЮДА_ДЛИННУЮ_СТРОКУ_КОТОРУЮ_СГЕНЕРИРОВАЛИ` — на ту строку что выдала команда выше
- `admin@вашдомен.ru` — на ваш email
- `НадёжныйПароль123!` — на надёжный пароль (минимум 8 символов, буквы и цифры)
- `вашдомен.ru` — на ваш домен

### Шаг 6: Проверьте что бэкенд запускается:

```bash
source /opt/taxi-app/backend/venv/bin/activate
cd /opt/taxi-app/backend
python3 -m uvicorn server:app --host 0.0.0.0 --port 8001
```

Должно показать:
```
INFO:     Uvicorn running on http://0.0.0.0:8001
INFO:     Application startup complete.
```

Нажмите `Ctrl+C` чтобы остановить (мы потом запустим его как сервис).

---

## 10. Настройка фронтенда

### Шаг 1: Перейдите в папку фронтенда:

```bash
cd /opt/taxi-app/frontend
```

### Шаг 2: Создайте файл настроек:

```bash
nano /opt/taxi-app/frontend/.env
```

Вставьте (замените домен на свой):

```
REACT_APP_BACKEND_URL=https://вашдомен.ru
```

Сохраните (`Ctrl+X` → `Y` → `Enter`).

> **Если у вас пока нет домена**, используйте IP-адрес:
> ```
> REACT_APP_BACKEND_URL=http://185.104.XXX.XXX
> ```

### Шаг 3: Установите зависимости:

```bash
yarn install
```

> Занимает 2-5 минут. Не пугайтесь предупреждений (warnings) — это нормально.

### Шаг 4: Соберите фронтенд:

```bash
yarn build
```

> Занимает 1-3 минуты. В конце должно показать:
> ```
> Compiled successfully.
> ```

### Шаг 5: Проверьте что сборка создалась:

```bash
ls /opt/taxi-app/frontend/build/
```

Должны быть файлы: `index.html`, `static/`, и другие.

---

## 11. Запуск бэкенда как сервиса

Сервис — это программа, которая работает постоянно в фоне и автоматически перезапускается.

### Шаг 1: Создайте файл сервиса:

```bash
nano /etc/systemd/system/taxi-backend.service
```

Вставьте:

```ini
[Unit]
Description=Taxi Ryadom Backend API
After=network.target mongod.service
Wants=mongod.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/taxi-app/backend
Environment=PATH=/opt/taxi-app/backend/venv/bin:/usr/local/bin:/usr/bin:/bin
EnvironmentFile=/opt/taxi-app/backend/.env
ExecStart=/opt/taxi-app/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Сохраните (`Ctrl+X` → `Y` → `Enter`).

### Шаг 2: Запустите сервис:

```bash
systemctl daemon-reload
systemctl start taxi-backend
systemctl enable taxi-backend
```

### Шаг 3: Проверьте что работает:

```bash
systemctl status taxi-backend
```

Должно быть **active (running)**.

Дополнительная проверка — откройте API:

```bash
curl http://localhost:8001/api/settings/public
```

Должен вернуть JSON с настройками. Если видите `{"app_name":"Рядом"...}` — бэкенд работает!

---

## 12. Настройка Nginx (веб-сервера)

### Шаг 1: Удалите стандартный конфиг:

```bash
rm /etc/nginx/sites-enabled/default
```

### Шаг 2: Создайте конфиг для вашего сайта:

```bash
nano /etc/nginx/sites-available/taxi-ryadom
```

**Если у вас ЕСТЬ домен**, вставьте:

```nginx
server {
    listen 80;
    server_name вашдомен.ru www.вашдомен.ru;

    # Фронтенд — собранные статические файлы React
    root /opt/taxi-app/frontend/build;
    index index.html;

    # Все API запросы проксируем на бэкенд
    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket соединения (для real-time отслеживания водителя)
    location /ws/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }

    # Все остальные запросы — отдаём React (SPA routing)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Сжатие для быстрой загрузки
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;

    # Максимальный размер загружаемого файла
    client_max_body_size 10M;
}
```

**Если у вас НЕТ домена** (только IP), замените первую строку:

```nginx
server {
    listen 80;
    server_name 185.104.XXX.XXX;
    # ... остальное то же самое
```

Сохраните файл.

### Шаг 3: Активируйте конфиг:

```bash
ln -sf /etc/nginx/sites-available/taxi-ryadom /etc/nginx/sites-enabled/taxi-ryadom
```

### Шаг 4: Проверьте конфиг на ошибки:

```bash
nginx -t
```

Должно показать:
```
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### Шаг 5: Перезапустите Nginx:

```bash
systemctl restart nginx
```

### Шаг 6: Проверьте!

Откройте в браузере: `http://ВАШ_IP` (или `http://вашдомен.ru`)

Должна появиться страница с логотипом «Рядом» и кнопками «Войти как заказчик» / «Войти как исполнитель».

**Если видите пустую страницу или ошибку** — смотрите раздел [«Решение проблем»](#20-решение-проблем).

---

## 13. Подключение домена

### Шаг 1: Купите домен

Домен можно купить на:
- [reg.ru](https://www.reg.ru/)
- [timeweb.com](https://timeweb.com/ru/services/domains/)
- [nic.ru](https://www.nic.ru/)

### Шаг 2: Настройте DNS

В панели управления доменом создайте **A-записи**:

| Тип | Имя | Значение |
|-----|------|----------|
| A | @ | 185.104.XXX.XXX |
| A | www | 185.104.XXX.XXX |

Замените `185.104.XXX.XXX` на IP вашего сервера.

> DNS обновляется от 5 минут до 24 часов. Обычно 15-30 минут.

### Шаг 3: Проверьте DNS

```bash
# Выполните на сервере:
dig вашдомен.ru +short
```

Если показывает ваш IP — DNS настроен!

---

## 14. SSL-сертификат (HTTPS)

SSL нужен чтобы сайт работал по `https://` — это безопасное соединение.

> **ВАЖНО:** SSL можно поставить только после того, как домен привязан к серверу (шаг 13).

### Шаг 1: Установите Certbot:

```bash
apt install -y certbot python3-certbot-nginx
```

### Шаг 2: Получите сертификат:

```bash
certbot --nginx -d вашдомен.ru -d www.вашдомен.ru
```

Программа спросит:
1. **Email** — введите свой (для уведомлений об истечении)
2. **Agree to terms** — введите `Y`
3. **Share email** — введите `N`

Если всё прошло успешно, увидите:
```
Congratulations! You have successfully enabled HTTPS
```

### Шаг 3: Проверьте автообновление:

```bash
certbot renew --dry-run
```

Если видите "Congratulations" — автообновление работает.

### Шаг 4: Обновите .env фронтенда:

```bash
nano /opt/taxi-app/frontend/.env
```

Убедитесь что URL начинается с `https://`:
```
REACT_APP_BACKEND_URL=https://вашдомен.ru
```

Пересоберите фронтенд:
```bash
cd /opt/taxi-app/frontend
yarn build
```

Перезапустите Nginx:
```bash
systemctl restart nginx
```

---

## 15. Настройка файрвола

Файрвол защищает сервер от несанкционированного доступа.

```bash
ufw allow 22/tcp    # SSH (удалённый доступ)
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw enable
```

Программа спросит подтверждение — введите `y`.

### Проверьте:

```bash
ufw status
```

Должны быть открыты порты 22, 80, 443.

---

## 16. Создание администратора

Администратор создаётся автоматически при первом запуске бэкенда. Данные берутся из файла `.env`:

- **Email:** значение `ADMIN_EMAIL` из `/opt/taxi-app/backend/.env`
- **Пароль:** значение `ADMIN_PASSWORD` из `/opt/taxi-app/backend/.env`

### Проверьте что админ создан:

```bash
mongosh taxi_production --eval "db.users.findOne({role: 'admin'})"
```

Если видите объект с `role: 'admin'` — админ существует.

### Если админа нет, перезапустите бэкенд:

```bash
systemctl restart taxi-backend
```

При старте бэкенд автоматически создаёт админа.

### Вход в админ-панель:

1. Откройте `https://вашдомен.ru/admin/login`
2. Введите email и пароль из `.env` файла
3. Нажмите «Войти»

---

## 17. Проверка работоспособности

### Чек-лист:

| Что проверяем | URL | Ожидаемый результат |
|--|--|--|
| Главная страница | `https://вашдомен.ru` | Страница с кнопками «Заказчик» / «Исполнитель» |
| API бэкенда | `https://вашдомен.ru/api/settings/public` | JSON с настройками |
| Админ-панель | `https://вашдомен.ru/admin/login` | Форма входа |
| Регистрация | Нажмите «Заказчик» → введите телефон | Должен прийти код (в тестовом режиме используйте код **1234**) |

### Тестирование:

1. **Откройте главную** — выберите «Заказчик»
2. **Введите телефон** — любой номер формата +7 (900) 123-45-67
3. **Примите условия** — поставьте обе галочки
4. **Введите код** — используйте тестовый код **1234**
5. **Придумайте PIN** — введите 4 цифры, потом повторите
6. **Готово!** — вы на главном экране заказчика

### Проверка через терминал:

```bash
# Проверка API
curl -s https://вашдомен.ru/api/settings/public | python3 -m json.tool

# Проверка бэкенда
systemctl status taxi-backend

# Проверка MongoDB
systemctl status mongod

# Проверка Nginx
systemctl status nginx
```

---

## 18. Обновление сайта

Когда вы внесли изменения в код и хотите обновить сайт:

### Если используете GitHub:

```bash
cd /opt/taxi-app
git pull origin main
```

### Обновление бэкенда:

```bash
cd /opt/taxi-app/backend
source venv/bin/activate
pip install -r requirements.txt
systemctl restart taxi-backend
```

### Обновление фронтенда:

```bash
cd /opt/taxi-app/frontend
yarn install
yarn build
systemctl restart nginx
```

### Обновить всё одной командой:

Создайте скрипт обновления:

```bash
nano /opt/taxi-app/update.sh
```

Вставьте:

```bash
#!/bin/bash
echo "=== Обновление такси-сервиса Рядом ==="

echo "1. Получение обновлений из Git..."
cd /opt/taxi-app
git pull origin main

echo "2. Обновление бэкенда..."
cd /opt/taxi-app/backend
source venv/bin/activate
pip install -r requirements.txt
systemctl restart taxi-backend

echo "3. Обновление фронтенда..."
cd /opt/taxi-app/frontend
yarn install
yarn build

echo "4. Перезапуск Nginx..."
systemctl restart nginx

echo "=== Обновление завершено! ==="
echo "Проверьте сайт: https://вашдомен.ru"
```

Сделайте скрипт исполняемым:

```bash
chmod +x /opt/taxi-app/update.sh
```

Теперь для обновления просто запускайте:

```bash
/opt/taxi-app/update.sh
```

---

## 19. Бэкапы базы данных

### Создать бэкап вручную:

```bash
mkdir -p /opt/backups
mongodump --db taxi_production --out /opt/backups/$(date +%Y%m%d_%H%M%S)
```

### Восстановить из бэкапа:

```bash
mongorestore --db taxi_production /opt/backups/ДАТА/taxi_production/
```

Замените `ДАТА` на имя папки бэкапа.

### Автоматический ежедневный бэкап:

```bash
nano /etc/cron.d/taxi-backup
```

Вставьте:

```
# Бэкап каждый день в 3 часа ночи, хранить 14 дней
0 3 * * * root mkdir -p /opt/backups && mongodump --db taxi_production --out /opt/backups/$(date +\%Y\%m\%d) 2>/dev/null && find /opt/backups -maxdepth 1 -mtime +14 -type d -exec rm -rf {} \;
```

Сохраните. Теперь бэкапы будут создаваться каждую ночь.

### Просмотр бэкапов:

```bash
ls -la /opt/backups/
```

---

## 20. Решение проблем

### Проблема: Белая страница при открытии сайта

**Причина:** Фронтенд не собран или Nginx не обновлён.

**Решение:**
```bash
cd /opt/taxi-app/frontend
yarn build
systemctl restart nginx
```

### Проблема: Ошибка 502 Bad Gateway

**Причина:** Бэкенд не запущен.

**Решение:**
```bash
# Проверьте статус бэкенда
systemctl status taxi-backend

# Посмотрите логи (последние 50 строк)
journalctl -u taxi-backend -n 50 --no-pager

# Перезапустите
systemctl restart taxi-backend
```

### Проблема: Ошибка 504 Gateway Timeout

**Причина:** Бэкенд запущен, но не отвечает.

**Решение:**
```bash
# Проверьте работает ли бэкенд
curl http://localhost:8001/api/settings/public

# Если не работает — смотрите логи
journalctl -u taxi-backend -n 100 --no-pager
```

### Проблема: MongoDB не запускается

```bash
# Проверьте статус
systemctl status mongod

# Посмотрите логи
journalctl -u mongod -n 50 --no-pager

# Возможно нет места на диске:
df -h

# Перезапустите
systemctl restart mongod
```

### Проблема: WebSocket не работает (водитель не отслеживается)

**Причина:** Nginx не настроен для WebSocket.

Проверьте что в конфиге Nginx есть блок `location /ws/` с заголовками `Upgrade` и `Connection`. Если нет — добавьте по шаблону из шага 12.

### Проблема: SSL сертификат не ставится

**Причина:** DNS ещё не обновился.

**Решение:**
```bash
# Проверьте DNS
dig вашдомен.ru +short

# Если показывает не ваш IP — подождите и попробуйте снова
# DNS обновляется до 24 часов
```

### Проблема: Не могу войти в админ-панель

```bash
# Проверьте что админ существует
mongosh taxi_production --eval "db.users.findOne({role: 'admin'})"

# Если нет — проверьте .env и перезапустите
cat /opt/taxi-app/backend/.env
systemctl restart taxi-backend
```

### Проблема: «Код подтверждения не работает»

В тестовом режиме всегда работает код **1234**. Для настоящих SMS нужно подключить SMS-провайдера через админ-панель.

---

## Полезные команды

| Команда | Что делает |
|---------|-----------|
| `systemctl status taxi-backend` | Статус бэкенда |
| `systemctl restart taxi-backend` | Перезапуск бэкенда |
| `systemctl status nginx` | Статус Nginx |
| `systemctl restart nginx` | Перезапуск Nginx |
| `systemctl status mongod` | Статус MongoDB |
| `journalctl -u taxi-backend -f` | Логи бэкенда в реальном времени (Ctrl+C чтобы выйти) |
| `journalctl -u nginx -f` | Логи Nginx |
| `mongosh taxi_production` | Зайти в базу данных |
| `df -h` | Свободное место на диске |
| `htop` | Загрузка CPU и RAM (q чтобы выйти) |
| `reboot` | Перезагрузка сервера |

---

## Мониторинг системы

### Установите htop для удобного мониторинга:

```bash
apt install -y htop
htop
```

Нажмите `q` чтобы выйти.

### Проверка статистики базы данных:

```bash
mongosh taxi_production --eval "
  print('Пользователей: ' + db.users.countDocuments());
  print('Заказов: ' + db.orders.countDocuments());
  print('Водителей: ' + db.users.countDocuments({role: 'driver'}));
  print('Пассажиров: ' + db.users.countDocuments({role: 'customer'}));
"
```

---

## Структура проекта

```
/opt/taxi-app/
├── backend/                # Серверная часть (Python/FastAPI)
│   ├── server.py           # Главный файл бэкенда
│   ├── requirements.txt    # Зависимости Python
│   ├── .env                # Секретные настройки
│   └── venv/               # Виртуальное окружение Python
├── frontend/               # Клиентская часть (React)
│   ├── src/                # Исходный код React
│   ├── build/              # Собранные файлы (для Nginx)
│   ├── package.json        # Зависимости JavaScript
│   └── .env                # Настройки фронтенда
├── docs/                   # Документация
│   └── timeweb_guide.md    # Это руководство
└── update.sh               # Скрипт обновления
```

---

## Готово!

Ваш такси-сервис «Рядом» установлен и работает.

**Следующие шаги:**
1. Войдите в админ-панель и настройте название/иконку приложения
2. Настройте тексты правил для пассажиров и водителей
3. Подключите SMS-провайдера (SMS.ru) для реальной отправки кодов
4. Подключите OneSignal для push-уведомлений
5. Подключите API карт (Яндекс.Карты / Google Maps / 2GIS)

---

> **Нужна помощь?** Если что-то не получается — перечитайте раздел «Решение проблем» или обратитесь в поддержку Timeweb.
