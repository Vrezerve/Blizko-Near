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
