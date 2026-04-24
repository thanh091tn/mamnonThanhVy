#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/mamnonThanhVy}"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
BRANCH="${DEPLOY_BRANCH:-main}"
BACKEND_SERVICE="${BACKEND_SERVICE:-mamnon-backend}"

echo "Deploying branch '$BRANCH' in $APP_DIR"

cd "$APP_DIR"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "Installing backend dependencies"
cd "$BACKEND_DIR"
npm ci --omit=dev

echo "Refreshing students from SQL"
npm run db:refresh-students

echo "Installing frontend dependencies"
cd "$FRONTEND_DIR"
npm ci

echo "Building frontend"
npm run build

echo "Restarting backend service"
systemctl restart "$BACKEND_SERVICE"

echo "Reloading nginx"
systemctl reload nginx

echo "Deployment completed successfully"
