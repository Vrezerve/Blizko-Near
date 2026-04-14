<?php
/**
 * Веб-инсталлятор такси-сервиса «Рядом»
 * Загрузите файл на VDS, откройте в браузере: http://ваш-сервер/install.php
 * После установки — удалите этот файл!
 */

// === Безопасность: запрет повторной установки ===
$lockFile = __DIR__ . '/.install_lock';

// === Утилиты ===
function run($cmd) {
    $output = [];
    $code = 0;
    exec($cmd . ' 2>&1', $output, $code);
    return ['output' => implode("\n", $output), 'code' => $code];
}

function getVersion($cmd) {
    $r = run($cmd);
    return $r['code'] === 0 ? trim($r['output']) : null;
}

function isServiceActive($name) {
    $r = run("systemctl is-active $name");
    return trim($r['output']) === 'active';
}

function getServerIP() {
    $r = run("curl -s --max-time 5 ifconfig.me");
    if ($r['code'] === 0 && filter_var(trim($r['output']), FILTER_VALIDATE_IP)) {
        return trim($r['output']);
    }
    $r = run("hostname -I");
    $ips = explode(' ', trim($r['output']));
    return $ips[0] ?? '127.0.0.1';
}

// === Определение базовой директории ===
$baseDir = dirname(__FILE__);

// === AJAX обработчик ===
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    header('Content-Type: application/json; charset=utf-8');
    $action = $_POST['action'];

    // --- Проверка блокировки ---
    if (file_exists($lockFile) && $action !== 'check_lock') {
        echo json_encode(['ok' => false, 'error' => 'Установка уже была выполнена. Удалите файл .install_lock для повторной установки.']);
        exit;
    }

    switch ($action) {

    // ============ ШАГ 0: Проверка блокировки ============
    case 'check_lock':
        echo json_encode(['ok' => true, 'locked' => file_exists($lockFile)]);
        exit;

    // ============ ШАГ 1: Проверка системы ============
    case 'check_system':
        $checks = [];

        // Node.js
        $v = getVersion('node --version');
        $checks['nodejs'] = ['installed' => $v !== null, 'version' => $v];

        // Yarn
        $v = getVersion('yarn --version');
        $checks['yarn'] = ['installed' => $v !== null, 'version' => $v];

        // Python3
        $v = getVersion('python3 --version');
        $checks['python3'] = ['installed' => $v !== null, 'version' => $v];

        // pip3
        $v = getVersion('pip3 --version');
        $checks['pip3'] = ['installed' => $v !== null, 'version' => $v ? explode(' ', $v)[1] ?? $v : null];

        // MongoDB
        $mongoActive = isServiceActive('mongod');
        $v = getVersion('mongod --version | head -1');
        $checks['mongodb'] = ['installed' => $v !== null || $mongoActive, 'version' => $v, 'running' => $mongoActive];

        // Nginx
        $nginxActive = isServiceActive('nginx');
        $v = getVersion('nginx -v 2>&1');
        $checks['nginx'] = ['installed' => $v !== null || $nginxActive, 'version' => $v, 'running' => $nginxActive];

        // Certbot
        $v = getVersion('certbot --version 2>&1');
        $checks['certbot'] = ['installed' => $v !== null, 'version' => $v];

        // Файлы проекта
        $checks['project'] = [
            'backend' => file_exists($baseDir . '/backend/server.py'),
            'requirements' => file_exists($baseDir . '/backend/requirements.txt'),
            'frontend' => file_exists($baseDir . '/frontend/package.json'),
        ];

        // IP сервера
        $checks['server_ip'] = getServerIP();

        // shell_exec доступен?
        $checks['shell_exec'] = function_exists('exec');

        // Запущен от root?
        $r = run('id -u');
        $checks['is_root'] = trim($r['output']) === '0';

        echo json_encode(['ok' => true, 'checks' => $checks]);
        exit;

    // ============ ШАГ 2: Установка недостающих компонентов ============
    case 'install_deps':
        $what = $_POST['components'] ?? '';
        $components = json_decode($what, true) ?? [];
        $results = [];

        // Обновление пакетов
        run('apt-get update -qq');

        // Базовые утилиты
        run('apt-get install -y curl wget git unzip lsb-release gnupg software-properties-common');

        foreach ($components as $comp) {
            switch ($comp) {
                case 'nodejs':
                    $r = run('curl -fsSL https://deb.nodesource.com/setup_20.x | bash -');
                    $r2 = run('apt-get install -y nodejs');
                    $r3 = run('npm install -g yarn');
                    $results['nodejs'] = $r2['code'] === 0;
                    $results['yarn'] = $r3['code'] === 0;
                    break;
                case 'python3':
                    $r = run('apt-get install -y python3 python3-pip python3-venv python3-dev');
                    $results['python3'] = $r['code'] === 0;
                    break;
                case 'mongodb':
                    run('curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg');
                    $codename = trim(run('lsb_release -cs')['output']) ?: 'jammy';
                    run("echo 'deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu {$codename}/mongodb-org/7.0 multiverse' | tee /etc/apt/sources.list.d/mongodb-org-7.0.list");
                    run('apt-get update -qq');
                    $r = run('apt-get install -y mongodb-org');
                    if ($r['code'] !== 0) {
                        run("echo 'deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/7.0 multiverse' | tee /etc/apt/sources.list.d/mongodb-org-7.0.list");
                        run('apt-get update -qq');
                        $r = run('apt-get install -y mongodb-org');
                    }
                    run('systemctl start mongod');
                    run('systemctl enable mongod');
                    $results['mongodb'] = $r['code'] === 0;
                    break;
                case 'nginx':
                    $r = run('apt-get install -y nginx');
                    run('systemctl start nginx');
                    run('systemctl enable nginx');
                    $results['nginx'] = $r['code'] === 0;
                    break;
            }
        }

        echo json_encode(['ok' => true, 'results' => $results]);
        exit;

    // ============ ШАГ 3: Настройка бэкенда ============
    case 'setup_backend':
        $domain = $_POST['domain'] ?? '';
        $protocol = $_POST['protocol'] ?? 'http';
        $adminEmail = $_POST['admin_email'] ?? 'admin@taxi.local';
        $adminPassword = $_POST['admin_password'] ?? '';
        $jwtSecret = $_POST['jwt_secret'] ?? bin2hex(random_bytes(32));
        $mongoUrl = $_POST['mongo_url'] ?? 'mongodb://localhost:27017';
        $dbName = $_POST['db_name'] ?? 'taxi_production';

        $backendDir = $baseDir . '/backend';
        $steps = [];

        // Venv
        if (!is_dir($backendDir . '/venv')) {
            $r = run("cd $backendDir && python3 -m venv venv");
            $steps[] = ['name' => 'Виртуальное окружение', 'ok' => $r['code'] === 0, 'detail' => $r['output']];
        } else {
            $steps[] = ['name' => 'Виртуальное окружение', 'ok' => true, 'detail' => 'Уже существует'];
        }

        // pip install
        $r = run("cd $backendDir && source venv/bin/activate && pip install --upgrade pip && pip install -r requirements.txt");
        $steps[] = ['name' => 'Python зависимости', 'ok' => $r['code'] === 0, 'detail' => $r['code'] === 0 ? 'Установлены' : $r['output']];

        // .env
        $corsOrigins = "{$protocol}://{$domain}";
        if (!filter_var($domain, FILTER_VALIDATE_IP)) {
            $corsOrigins .= ",{$protocol}://www.{$domain}";
        }

        $env = "MONGO_URL={$mongoUrl}\n";
        $env .= "DB_NAME={$dbName}\n";
        $env .= "JWT_SECRET={$jwtSecret}\n";
        $env .= "ADMIN_EMAIL={$adminEmail}\n";
        $env .= "ADMIN_PASSWORD={$adminPassword}\n";
        $env .= "CORS_ORIGINS={$corsOrigins}\n";

        file_put_contents($backendDir . '/.env', $env);
        chmod($backendDir . '/.env', 0600);
        $steps[] = ['name' => 'Файл .env', 'ok' => true, 'detail' => 'Создан (права 600)'];

        // uploads dir
        @mkdir($backendDir . '/uploads', 0755, true);
        $steps[] = ['name' => 'Папка uploads', 'ok' => true, 'detail' => 'Создана'];

        echo json_encode(['ok' => true, 'steps' => $steps]);
        exit;

    // ============ ШАГ 4: Настройка фронтенда ============
    case 'setup_frontend':
        $domain = $_POST['domain'] ?? '';
        $protocol = $_POST['protocol'] ?? 'http';

        $frontendDir = $baseDir . '/frontend';
        $steps = [];

        // .env
        $env = "REACT_APP_BACKEND_URL={$protocol}://{$domain}\n";
        file_put_contents($frontendDir . '/.env', $env);
        $steps[] = ['name' => 'Файл .env', 'ok' => true, 'detail' => 'Создан'];

        // yarn install
        $r = run("cd $frontendDir && yarn install --production=false");
        $steps[] = ['name' => 'JS зависимости (yarn)', 'ok' => $r['code'] === 0, 'detail' => $r['code'] === 0 ? 'Установлены' : substr($r['output'], -300)];

        // yarn build
        $r = run("cd $frontendDir && yarn build");
        $ok = file_exists($frontendDir . '/build/index.html');
        $steps[] = ['name' => 'Сборка (yarn build)', 'ok' => $ok, 'detail' => $ok ? 'build/index.html создан' : substr($r['output'], -300)];

        echo json_encode(['ok' => true, 'steps' => $steps]);
        exit;

    // ============ ШАГ 5: Создание сервиса + Nginx ============
    case 'setup_services':
        $domain = $_POST['domain'] ?? '';
        $protocol = $_POST['protocol'] ?? 'http';
        $useSSL = $_POST['use_ssl'] ?? 'no';
        $adminEmail = $_POST['admin_email'] ?? '';

        $steps = [];

        // --- systemd сервис ---
        $service = "[Unit]
Description=Taxi Ryadom Backend API
After=network.target mongod.service
Wants=mongod.service

[Service]
Type=simple
User=root
WorkingDirectory={$baseDir}/backend
Environment=PATH={$baseDir}/backend/venv/bin:/usr/local/bin:/usr/bin:/bin
EnvironmentFile={$baseDir}/backend/.env
ExecStart={$baseDir}/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
";
        file_put_contents('/etc/systemd/system/taxi-backend.service', $service);
        run('systemctl daemon-reload');
        run('systemctl start taxi-backend');
        run('systemctl enable taxi-backend');

        sleep(3);
        $backendOk = isServiceActive('taxi-backend');
        $steps[] = ['name' => 'Сервис taxi-backend', 'ok' => $backendOk, 'detail' => $backendOk ? 'Запущен' : 'Ошибка запуска. Проверьте: journalctl -u taxi-backend -n 30'];

        // --- Nginx конфиг ---
        $serverName = $domain;
        if (!filter_var($domain, FILTER_VALIDATE_IP)) {
            $serverName = "$domain www.$domain";
        }

        $nginxConf = 'server {
    listen 80;
    server_name ' . $serverName . ';

    root ' . $baseDir . '/frontend/build;
    index index.html;

    # API
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

    # WebSocket
    location /ws/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }

    # React SPA
    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;

    client_max_body_size 10M;
}
';
        file_put_contents('/etc/nginx/sites-available/taxi-ryadom', $nginxConf);
        @unlink('/etc/nginx/sites-enabled/default');
        @symlink('/etc/nginx/sites-available/taxi-ryadom', '/etc/nginx/sites-enabled/taxi-ryadom');

        $r = run('nginx -t');
        $nginxOk = $r['code'] === 0;
        if ($nginxOk) {
            run('systemctl restart nginx');
        }
        $steps[] = ['name' => 'Nginx конфигурация', 'ok' => $nginxOk, 'detail' => $nginxOk ? 'Конфиг корректен, Nginx перезапущен' : $r['output']];

        // --- SSL ---
        if ($useSSL === 'yes' && !filter_var($domain, FILTER_VALIDATE_IP)) {
            if (!getVersion('certbot --version 2>&1')) {
                run('apt-get install -y certbot python3-certbot-nginx');
            }
            $certArgs = "--nginx -d $domain --non-interactive --agree-tos --email $adminEmail";
            if (!filter_var($domain, FILTER_VALIDATE_IP)) {
                $certArgs .= " -d www.$domain";
            }
            $r = run("certbot $certArgs");
            $sslOk = $r['code'] === 0;
            $steps[] = ['name' => 'SSL сертификат', 'ok' => $sslOk, 'detail' => $sslOk ? 'Установлен' : 'Ошибка: ' . substr($r['output'], -200)];
        }

        // --- Файрвол ---
        $r = run('which ufw');
        if ($r['code'] === 0) {
            run('ufw allow 22/tcp');
            run('ufw allow 80/tcp');
            run('ufw allow 443/tcp');
            $steps[] = ['name' => 'Файрвол (UFW)', 'ok' => true, 'detail' => 'Порты 22, 80, 443 открыты'];
        }

        // --- Скрипт обновления ---
        $updateSh = '#!/bin/bash
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
';
        file_put_contents($baseDir . '/update.sh', $updateSh);
        chmod($baseDir . '/update.sh', 0755);
        $steps[] = ['name' => 'Скрипт обновления', 'ok' => true, 'detail' => 'update.sh создан'];

        // --- Автобэкап ---
        $cron = '0 3 * * * root mkdir -p /opt/backups && mongodump --db taxi_production --out /opt/backups/$(date +\%Y\%m\%d) 2>/dev/null && find /opt/backups -maxdepth 1 -mtime +14 -type d -exec rm -rf {} \;' . "\n";
        file_put_contents('/etc/cron.d/taxi-backup', $cron);
        $steps[] = ['name' => 'Автобэкап MongoDB', 'ok' => true, 'detail' => 'Каждую ночь в 3:00'];

        echo json_encode(['ok' => true, 'steps' => $steps]);
        exit;

    // ============ ШАГ 6: Финальная проверка ============
    case 'final_check':
        $domain = $_POST['domain'] ?? '';
        $protocol = $_POST['protocol'] ?? 'http';

        $checks = [];
        $checks['mongodb'] = isServiceActive('mongod');
        $checks['backend'] = isServiceActive('taxi-backend');
        $checks['nginx'] = isServiceActive('nginx');

        // API check
        $r = run('curl -s --max-time 5 http://localhost:8001/api/settings/public');
        $checks['api'] = strpos($r['output'], 'app_name') !== false;

        // Frontend
        $checks['frontend_build'] = file_exists($baseDir . '/frontend/build/index.html');

        // Website
        $r = run("curl -s --max-time 5 http://{$domain}");
        $checks['website'] = strpos($r['output'], 'html') !== false;

        // Создать lock-файл
        file_put_contents($lockFile, date('Y-m-d H:i:s'));

        echo json_encode(['ok' => true, 'checks' => $checks]);
        exit;

    // ============ Удаление install.php ============
    case 'self_delete':
        $deleted = @unlink(__FILE__);
        echo json_encode(['ok' => $deleted]);
        exit;

    default:
        echo json_encode(['ok' => false, 'error' => 'Unknown action']);
        exit;
    }
}
?>
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Установка — Такси «Рядом»</title>
<style>
:root {
  --bg: #0c0f14;
  --surface: #151921;
  --surface2: #1c2230;
  --border: #2a3245;
  --text: #e2e8f0;
  --text-dim: #8892a4;
  --accent: #38bdf8;
  --accent-glow: rgba(56, 189, 248, 0.15);
  --green: #34d399;
  --red: #f87171;
  --yellow: #fbbf24;
  --radius: 10px;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Segoe UI', -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  display: flex;
  justify-content: center;
  padding: 30px 16px;
}
.container {
  max-width: 680px;
  width: 100%;
}

/* Header */
.header {
  text-align: center;
  margin-bottom: 36px;
}
.header h1 {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.5px;
}
.header h1 span { color: var(--accent); }
.header p {
  color: var(--text-dim);
  margin-top: 6px;
  font-size: 14px;
}

/* Progress bar */
.progress-track {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 32px;
}
.progress-segment {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--border);
  transition: background 0.4s;
}
.progress-segment.done { background: var(--accent); }
.progress-segment.active {
  background: var(--accent);
  animation: pulse-bar 1.2s ease-in-out infinite;
}
@keyframes pulse-bar {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Step card */
.step-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 28px;
  display: none;
  animation: fadeIn 0.3s ease;
}
.step-card.active { display: block; }
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.step-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 6px;
}
.step-subtitle {
  font-size: 13px;
  color: var(--text-dim);
  margin-bottom: 22px;
}

/* Check items */
.check-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}
.check-item {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--surface2);
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 14px;
  transition: opacity 0.2s;
}
.check-icon {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}
.check-icon.ok { background: rgba(52,211,153,0.15); color: var(--green); }
.check-icon.fail { background: rgba(248,113,113,0.15); color: var(--red); }
.check-icon.warn { background: rgba(251,191,36,0.15); color: var(--yellow); }
.check-icon.wait { background: rgba(56,189,248,0.1); color: var(--accent); }
.check-detail {
  color: var(--text-dim);
  font-size: 12px;
  margin-left: auto;
  white-space: nowrap;
}

/* Form */
.form-group {
  margin-bottom: 16px;
}
.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 6px;
  color: var(--text-dim);
}
.form-group input, .form-group select {
  width: 100%;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 14px;
  color: var(--text);
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}
.form-group input:focus, .form-group select:focus {
  border-color: var(--accent);
}
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

/* Buttons */
.btn-row {
  display: flex;
  gap: 10px;
  margin-top: 24px;
}
.btn {
  padding: 11px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
  flex-shrink: 0;
}
.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.btn-primary {
  background: var(--accent);
  color: #0c0f14;
}
.btn-primary:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}
.btn-secondary {
  background: var(--surface2);
  color: var(--text);
  border: 1px solid var(--border);
}
.btn-danger {
  background: rgba(248,113,113,0.15);
  color: var(--red);
  border: 1px solid rgba(248,113,113,0.3);
}
.btn-danger:hover:not(:disabled) {
  background: rgba(248,113,113,0.25);
}

/* Spinner */
.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  margin-right: 8px;
  vertical-align: middle;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Log output */
.log-box {
  background: #0a0d11;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 12px;
  color: var(--text-dim);
  max-height: 180px;
  overflow-y: auto;
  margin-bottom: 16px;
  line-height: 1.7;
  white-space: pre-wrap;
}
.log-box .log-ok { color: var(--green); }
.log-box .log-err { color: var(--red); }
.log-box .log-info { color: var(--accent); }

/* Summary */
.summary-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 16px;
  font-size: 14px;
  margin: 16px 0;
}
.summary-label { color: var(--text-dim); }
.summary-value { font-weight: 600; color: var(--text); }

/* Warning box */
.warn-box {
  background: rgba(248,113,113,0.08);
  border: 1px solid rgba(248,113,113,0.25);
  border-radius: 8px;
  padding: 14px 16px;
  font-size: 13px;
  color: var(--red);
  margin-top: 16px;
  line-height: 1.6;
}

/* Toggle */
.toggle-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  font-size: 14px;
}
.toggle {
  position: relative;
  width: 42px;
  height: 24px;
  flex-shrink: 0;
}
.toggle input { display: none; }
.toggle-track {
  position: absolute;
  inset: 0;
  background: var(--border);
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s;
}
.toggle input:checked + .toggle-track { background: var(--accent); }
.toggle-track::after {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  top: 3px;
  left: 3px;
  transition: transform 0.2s;
}
.toggle input:checked + .toggle-track::after {
  transform: translateX(18px);
}
</style>
</head>
<body>
<div class="container">

  <div class="header">
    <h1>Такси <span>«Рядом»</span></h1>
    <p>Веб-инсталлятор v1.0</p>
  </div>

  <div class="progress-track" id="progressTrack"></div>

  <!-- ========== ШАГ 0: Приветствие ========== -->
  <div class="step-card active" id="step-0">
    <div class="step-title">Добро пожаловать</div>
    <div class="step-subtitle">Этот инсталлятор настроит ваш такси-сервис автоматически</div>
    <div class="check-list">
      <div class="check-item">
        <div class="check-icon ok">1</div>
        <div>Проверка системы и зависимостей</div>
      </div>
      <div class="check-item">
        <div class="check-icon ok">2</div>
        <div>Установка недостающих компонентов</div>
      </div>
      <div class="check-item">
        <div class="check-icon ok">3</div>
        <div>Настройка параметров (домен, админ)</div>
      </div>
      <div class="check-item">
        <div class="check-icon ok">4</div>
        <div>Настройка бэкенда и фронтенда</div>
      </div>
      <div class="check-item">
        <div class="check-icon ok">5</div>
        <div>Конфигурация Nginx + SSL</div>
      </div>
      <div class="check-item">
        <div class="check-icon ok">6</div>
        <div>Финальная проверка</div>
      </div>
    </div>
    <div class="btn-row">
      <button class="btn btn-primary" onclick="goStep(1)">Начать установку</button>
    </div>
  </div>

  <!-- ========== ШАГ 1: Проверка системы ========== -->
  <div class="step-card" id="step-1">
    <div class="step-title">Проверка системы</div>
    <div class="step-subtitle">Проверяем наличие необходимых компонентов</div>
    <div class="check-list" id="sysChecks">
      <div class="check-item"><div class="check-icon wait"><span class="spinner" style="width:14px;height:14px;border-width:2px;margin:0"></span></div><div>Сканирование...</div></div>
    </div>
    <div id="sysResult" style="display:none">
      <div class="btn-row">
        <button class="btn btn-primary" id="btnStep1Next" onclick="goStep(2)" disabled>Далее</button>
      </div>
    </div>
  </div>

  <!-- ========== ШАГ 2: Установка зависимостей ========== -->
  <div class="step-card" id="step-2">
    <div class="step-title">Установка компонентов</div>
    <div class="step-subtitle" id="step2subtitle">Устанавливаем недостающие компоненты</div>
    <div class="log-box" id="installLog" style="display:none"></div>
    <div class="check-list" id="installChecks"></div>
    <div class="btn-row">
      <button class="btn btn-primary" id="btnInstall" onclick="installDeps()">Установить</button>
      <button class="btn btn-primary" id="btnStep2Next" onclick="goStep(3)" style="display:none">Далее</button>
    </div>
  </div>

  <!-- ========== ШАГ 3: Настройки ========== -->
  <div class="step-card" id="step-3">
    <div class="step-title">Настройки</div>
    <div class="step-subtitle">Укажите только домен. Остальное настроится автоматически.</div>
    <div class="form-group">
      <label>Домен или IP-адрес сервера</label>
      <input type="text" id="cfgDomain" placeholder="example.com или 123.45.67.89">
    </div>
    <input type="hidden" id="cfgSSL" value="">
    <input type="hidden" id="cfgAdminEmail" value="admin@taxi.local">
    <input type="hidden" id="cfgAdminPass" value="admin123">
    <input type="hidden" id="cfgMongoUrl" value="mongodb://localhost:27017">
    <input type="hidden" id="cfgDbName" value="taxi_production">
    <div class="check-list" style="margin-top:16px">
      <div class="check-item"><div class="check-icon ok">&#10003;</div><div>MongoDB: localhost:27017 / taxi_production</div></div>
      <div class="check-item"><div class="check-icon ok">&#10003;</div><div>Админ: admin@taxi.local / admin123</div></div>
      <div class="check-item"><div class="check-icon ok">&#10003;</div><div>Тестовый режим: включён (код 1234)</div></div>
    </div>
    <p style="font-size:12px;color:var(--text-dim);margin-top:12px">Пароль и настройки можно сменить в Админ-панели после установки</p>
    <div class="btn-row">
      <button class="btn btn-secondary" onclick="goStep(2)">Назад</button>
      <button class="btn btn-primary" onclick="validateAndGo()">Установить</button>
    </div>
  </div>

  <!-- ========== ШАГ 4: Настройка бэкенда + фронтенда ========== -->
  <div class="step-card" id="step-4">
    <div class="step-title">Сборка приложения</div>
    <div class="step-subtitle">Настройка бэкенда и сборка фронтенда. Это может занять несколько минут.</div>
    <div class="log-box" id="buildLog"></div>
    <div class="check-list" id="buildChecks"></div>
    <div class="btn-row">
      <button class="btn btn-primary" id="btnStep4Next" onclick="goStep(5)" style="display:none">Далее</button>
    </div>
  </div>

  <!-- ========== ШАГ 5: Сервисы + Nginx ========== -->
  <div class="step-card" id="step-5">
    <div class="step-title">Запуск сервисов</div>
    <div class="step-subtitle">Создание systemd-сервиса, настройка Nginx и SSL</div>
    <div class="log-box" id="svcLog"></div>
    <div class="check-list" id="svcChecks"></div>
    <div class="btn-row">
      <button class="btn btn-primary" id="btnStep5Next" onclick="goStep(6)" style="display:none">Далее — Финальная проверка</button>
    </div>
  </div>

  <!-- ========== ШАГ 6: Финал ========== -->
  <div class="step-card" id="step-6">
    <div class="step-title">Финальная проверка</div>
    <div class="step-subtitle">Проверяем что всё запущено и работает</div>
    <div class="check-list" id="finalChecks">
      <div class="check-item"><div class="check-icon wait"><span class="spinner" style="width:14px;height:14px;border-width:2px;margin:0"></span></div><div>Проверка...</div></div>
    </div>
    <div id="finalResult" style="display:none"></div>
  </div>

</div>

<script>
const TOTAL_STEPS = 7;
let currentStep = 0;
let systemData = {};
let missingComponents = [];

// Config state
let cfg = {
  domain: '', protocol: 'http', ssl: false,
  adminEmail: '', adminPass: '',
  mongoUrl: 'mongodb://localhost:27017', dbName: 'taxi_production'
};

// === Helpers ===
function $(id) { return document.getElementById(id); }

function ajax(data) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    for (const k in data) fd.append(k, data[k]);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'install.php', true);
    xhr.onload = function() {
      try { resolve(JSON.parse(xhr.responseText)); }
      catch(e) { reject(xhr.responseText); }
    };
    xhr.onerror = () => reject('Network error');
    xhr.send(fd);
  });
}

function checkItem(ok, label, detail) {
  const iconCls = ok === true ? 'ok' : ok === false ? 'fail' : 'warn';
  const sym = ok === true ? '&#10003;' : ok === false ? '&#10007;' : '!';
  return `<div class="check-item">
    <div class="check-icon ${iconCls}">${sym}</div>
    <div>${label}</div>
    ${detail ? `<div class="check-detail">${detail}</div>` : ''}
  </div>`;
}

function logLine(box, text, cls) {
  const el = $(box);
  el.style.display = 'block';
  el.innerHTML += cls ? `<span class="${cls}">${text}</span>\n` : text + '\n';
  el.scrollTop = el.scrollHeight;
}

// === Progress ===
function updateProgress() {
  const track = $('progressTrack');
  let html = '';
  for (let i = 0; i < TOTAL_STEPS; i++) {
    const cls = i < currentStep ? 'done' : i === currentStep ? 'active' : '';
    html += `<div class="progress-segment ${cls}"></div>`;
  }
  track.innerHTML = html;
}

// === Step navigation ===
function goStep(n) {
  document.querySelectorAll('.step-card').forEach(el => el.classList.remove('active'));
  $('step-' + n).classList.add('active');
  currentStep = n;
  updateProgress();

  if (n === 1) runSystemCheck();
  if (n === 2) prepareInstallStep();
  if (n === 3) prefillConfig();
  if (n === 4) runBuild();
  if (n === 5) runServices();
  if (n === 6) runFinalCheck();
}

// === Step 1: System check ===
async function runSystemCheck() {
  const res = await ajax({ action: 'check_system' });
  if (!res.ok) return;
  const c = res.checks;
  systemData = c;
  missingComponents = [];

  let html = '';

  // shell_exec
  html += checkItem(c.shell_exec, 'Выполнение команд (exec)', c.shell_exec ? 'Доступно' : 'Заблокировано');

  // root
  html += checkItem(c.is_root, 'Права root', c.is_root ? 'Да' : 'Нет (может потребоваться sudo)');

  // Project files
  const projOk = c.project.backend && c.project.requirements && c.project.frontend;
  html += checkItem(projOk, 'Файлы проекта', projOk ? 'Найдены' : 'Не все файлы на месте');

  // Node.js
  if (c.nodejs.installed) {
    html += checkItem(true, 'Node.js', c.nodejs.version);
  } else {
    html += checkItem(false, 'Node.js', 'Не установлен');
    missingComponents.push('nodejs');
  }

  // Yarn
  if (c.yarn.installed) {
    html += checkItem(true, 'Yarn', c.yarn.version);
  } else {
    html += checkItem(false, 'Yarn', 'Не установлен');
    if (!missingComponents.includes('nodejs')) missingComponents.push('nodejs');
  }

  // Python3
  if (c.python3.installed) {
    html += checkItem(true, 'Python 3', c.python3.version);
  } else {
    html += checkItem(false, 'Python 3', 'Не установлен');
    missingComponents.push('python3');
  }

  // pip3
  if (c.pip3.installed) {
    html += checkItem(true, 'pip3', c.pip3.version);
  } else {
    html += checkItem(false, 'pip3', 'Не установлен');
    if (!missingComponents.includes('python3')) missingComponents.push('python3');
  }

  // MongoDB
  if (c.mongodb.installed) {
    html += checkItem(c.mongodb.running ? true : null, 'MongoDB', c.mongodb.running ? 'Запущен' : 'Установлен, не запущен');
    if (!c.mongodb.running) missingComponents.push('mongodb');
  } else {
    html += checkItem(false, 'MongoDB', 'Не установлен');
    missingComponents.push('mongodb');
  }

  // Nginx
  if (c.nginx.installed) {
    html += checkItem(c.nginx.running ? true : null, 'Nginx', c.nginx.running ? 'Запущен' : 'Установлен, не запущен');
    if (!c.nginx.running) missingComponents.push('nginx');
  } else {
    html += checkItem(false, 'Nginx', 'Не установлен');
    missingComponents.push('nginx');
  }

  // Certbot
  html += checkItem(c.certbot.installed ? true : null, 'Certbot (SSL)', c.certbot.installed ? c.certbot.version : 'Не установлен (опционально)');

  // Server IP
  html += checkItem(true, 'IP сервера', c.server_ip);

  $('sysChecks').innerHTML = html;
  $('sysResult').style.display = 'block';
  $('btnStep1Next').disabled = !c.shell_exec || !projOk;
}

// === Step 2: Install dependencies ===
function prepareInstallStep() {
  const list = $('installChecks');
  if (missingComponents.length === 0) {
    $('step2subtitle').textContent = 'Все компоненты уже установлены!';
    list.innerHTML = checkItem(true, 'Все компоненты на месте', '');
    $('btnInstall').style.display = 'none';
    $('btnStep2Next').style.display = 'inline-flex';
    return;
  }

  const names = {
    nodejs: 'Node.js 20 + Yarn',
    python3: 'Python 3 + pip',
    mongodb: 'MongoDB 7.0',
    nginx: 'Nginx'
  };

  let html = '';
  missingComponents.forEach(c => {
    html += checkItem(false, names[c] || c, 'Будет установлен');
  });
  list.innerHTML = html;
  $('btnInstall').style.display = 'inline-flex';
  $('btnStep2Next').style.display = 'none';
}

async function installDeps() {
  const btn = $('btnInstall');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Устанавливаем...';

  logLine('installLog', '> Запуск установки компонентов...', 'log-info');

  const res = await ajax({
    action: 'install_deps',
    components: JSON.stringify(missingComponents)
  });

  if (res.ok) {
    let html = '';
    for (const k in res.results) {
      const names = { nodejs: 'Node.js', yarn: 'Yarn', python3: 'Python 3', mongodb: 'MongoDB', nginx: 'Nginx' };
      html += checkItem(res.results[k], names[k] || k, res.results[k] ? 'Установлен' : 'Ошибка');
      logLine('installLog', (res.results[k] ? '[OK] ' : '[X] ') + (names[k] || k), res.results[k] ? 'log-ok' : 'log-err');
    }
    $('installChecks').innerHTML = html;
    logLine('installLog', '> Установка завершена', 'log-ok');
  } else {
    logLine('installLog', '> Ошибка: ' + (res.error || 'Unknown'), 'log-err');
  }

  btn.style.display = 'none';
  $('btnStep2Next').style.display = 'inline-flex';
}

// === Step 3: Config ===
function prefillConfig() {
  if (systemData.server_ip) {
    $('cfgDomain').value = $('cfgDomain').value || systemData.server_ip;
  }
}

function validateAndGo() {
  const domain = $('cfgDomain').value.trim();

  if (!domain) return alert('Введите домен или IP-адрес');

  const isIP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(domain);

  cfg = {
    domain: domain,
    protocol: 'http',
    ssl: false,
    adminEmail: 'admin@taxi.local',
    adminPass: 'admin123',
    mongoUrl: 'mongodb://localhost:27017',
    dbName: 'taxi_production'
  };

  goStep(4);
}

// === Step 4: Build ===
async function runBuild() {
  const log = 'buildLog';
  const checks = $('buildChecks');
  checks.innerHTML = '';

  // Backend
  logLine(log, '> Настройка бэкенда (Python)...', 'log-info');
  const bRes = await ajax({
    action: 'setup_backend',
    domain: cfg.domain,
    protocol: cfg.protocol,
    admin_email: cfg.adminEmail,
    admin_password: cfg.adminPass,
    mongo_url: cfg.mongoUrl,
    db_name: cfg.dbName
  });

  if (bRes.ok) {
    let html = '';
    bRes.steps.forEach(s => {
      html += checkItem(s.ok, s.name, s.detail);
      logLine(log, (s.ok ? '[OK] ' : '[X] ') + s.name + ': ' + s.detail, s.ok ? 'log-ok' : 'log-err');
    });
    checks.innerHTML = html;
  }

  // Frontend
  logLine(log, '', '');
  logLine(log, '> Сборка фронтенда (React)...', 'log-info');
  logLine(log, '  Это может занять 3-5 минут...', '');

  const fRes = await ajax({
    action: 'setup_frontend',
    domain: cfg.domain,
    protocol: cfg.protocol
  });

  if (fRes.ok) {
    let html = checks.innerHTML;
    fRes.steps.forEach(s => {
      html += checkItem(s.ok, s.name, s.detail);
      logLine(log, (s.ok ? '[OK] ' : '[X] ') + s.name + ': ' + s.detail, s.ok ? 'log-ok' : 'log-err');
    });
    checks.innerHTML = html;
  }

  logLine(log, '', '');
  logLine(log, '> Сборка завершена', 'log-ok');
  $('btnStep4Next').style.display = 'inline-flex';
}

// === Step 5: Services ===
async function runServices() {
  const log = 'svcLog';
  const checks = $('svcChecks');
  checks.innerHTML = '';

  logLine(log, '> Запуск сервисов и настройка Nginx...', 'log-info');

  const res = await ajax({
    action: 'setup_services',
    domain: cfg.domain,
    protocol: cfg.protocol,
    use_ssl: cfg.ssl ? 'yes' : 'no',
    admin_email: cfg.adminEmail
  });

  if (res.ok) {
    let html = '';
    res.steps.forEach(s => {
      html += checkItem(s.ok, s.name, s.detail);
      logLine(log, (s.ok ? '[OK] ' : '[X] ') + s.name + ': ' + s.detail, s.ok ? 'log-ok' : 'log-err');
    });
    checks.innerHTML = html;
  }

  logLine(log, '', '');
  logLine(log, '> Сервисы настроены', 'log-ok');
  $('btnStep5Next').style.display = 'inline-flex';
}

// === Step 6: Final ===
async function runFinalCheck() {
  const res = await ajax({
    action: 'final_check',
    domain: cfg.domain,
    protocol: cfg.protocol
  });

  if (!res.ok) return;
  const c = res.checks;

  let html = '';
  html += checkItem(c.mongodb, 'MongoDB', c.mongodb ? 'Работает' : 'Не запущен');
  html += checkItem(c.backend, 'Бэкенд (taxi-backend)', c.backend ? 'Работает' : 'Не запущен');
  html += checkItem(c.nginx, 'Nginx', c.nginx ? 'Работает' : 'Не запущен');
  html += checkItem(c.api, 'API отвечает', c.api ? '/api/settings/public' : 'Не отвечает');
  html += checkItem(c.frontend_build, 'Фронтенд собран', c.frontend_build ? 'build/index.html' : 'Не найден');
  html += checkItem(c.website ? true : null, 'Сайт открывается', c.website ? cfg.protocol + '://' + cfg.domain : 'Проверьте DNS');

  $('finalChecks').innerHTML = html;

  const allOk = c.mongodb && c.backend && c.nginx && c.api && c.frontend_build;

  let result = '';
  if (allOk) {
    result += '<div style="text-align:center;margin:20px 0 10px">';
    result += '<div style="font-size:20px;font-weight:700;color:var(--green)">Установка завершена успешно!</div>';
    result += '</div>';
  } else {
    result += '<div style="text-align:center;margin:20px 0 10px">';
    result += '<div style="font-size:20px;font-weight:700;color:var(--yellow)">Установка завершена с предупреждениями</div>';
    result += '</div>';
  }

  result += '<div class="summary-grid">';
  result += '<div class="summary-label">Сайт:</div><div class="summary-value"><a href="' + cfg.protocol + '://' + cfg.domain + '" target="_blank" style="color:var(--accent)">' + cfg.protocol + '://' + cfg.domain + '</a></div>';
  result += '<div class="summary-label">Админ-панель:</div><div class="summary-value"><a href="' + cfg.protocol + '://' + cfg.domain + '/admin/login" target="_blank" style="color:var(--accent)">' + cfg.protocol + '://' + cfg.domain + '/admin/login</a></div>';
  result += '<div class="summary-label">Логин админа:</div><div class="summary-value">admin@taxi.local</div>';
  result += '<div class="summary-label">Пароль админа:</div><div class="summary-value">admin123</div>';
  result += '<div class="summary-label">Тестовый OTP:</div><div class="summary-value">1234</div>';
  result += '<div class="summary-label">Обновление:</div><div class="summary-value">bash update.sh</div>';
  result += '</div>';
  
  result += '<p style="font-size:12px;color:var(--yellow);margin:12px 0">Смените пароль в админке после первого входа!</p>';

  result += '<div class="warn-box">Для безопасности удалите install.php с сервера!</div>';

  result += '<div class="btn-row" style="margin-top:20px">';
  result += '<a href="' + cfg.protocol + '://' + cfg.domain + '" target="_blank" class="btn btn-primary" style="text-decoration:none">Открыть сайт</a>';
  result += '<button class="btn btn-danger" onclick="selfDelete()">Удалить install.php</button>';
  result += '</div>';

  $('finalResult').innerHTML = result;
  $('finalResult').style.display = 'block';
}

async function selfDelete() {
  if (!confirm('Удалить install.php? Это действие необратимо.')) return;
  const res = await ajax({ action: 'self_delete' });
  if (res.ok) {
    alert('install.php удалён. Перенаправляем на сайт...');
    window.location.href = cfg.protocol + '://' + cfg.domain;
  } else {
    alert('Не удалось удалить файл. Удалите вручную: rm install.php');
  }
}

// === Init ===
updateProgress();

// Check if already installed
ajax({ action: 'check_lock' }).then(res => {
  if (res.locked) {
    $('step-0').innerHTML = `
      <div class="step-title">Установка уже выполнена</div>
      <div class="step-subtitle">Сервис был ранее установлен с помощью этого инсталлятора</div>
      <div class="warn-box">Удалите install.php с сервера для безопасности!<br>Или удалите файл .install_lock для повторной установки.</div>
      <div class="btn-row" style="margin-top:20px">
        <button class="btn btn-danger" onclick="selfDelete()">Удалить install.php</button>
      </div>
    `;
  }
});
</script>
</body>
</html>
