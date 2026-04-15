#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/mamnonThanhVy}"
BACKEND_SERVICE="${BACKEND_SERVICE:-mamnon-backend}"

echo "Checking app directory: $APP_DIR"
test -d "$APP_DIR"

echo "Checking git remote"
git -C "$APP_DIR" remote -v

echo "Checking backend environment file"
test -f "$APP_DIR/backend/.env"

echo "Checking systemd service"
systemctl status "$BACKEND_SERVICE" --no-pager || true

echo "Checking nginx config"
nginx -t

echo "Checking backend health endpoint"
curl -fsS http://127.0.0.1:3000/api/health

echo
echo "Server looks ready for GitHub Actions deployment"
