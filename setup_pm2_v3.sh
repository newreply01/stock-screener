#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

echo "Re-installing PM2 to be safe..."
npm install -g pm2

cd /home/xg/stock-screener
pm2 delete all || true

echo "Starting backend with 0.0.0.0 binding..."
pm2 start server/index.js --name backend

echo "Starting frontend with 0.0.0.0 binding on port 20000..."
cd client
pm2 start "npm run dev -- --host 0.0.0.0 --port 20000" --name frontend

pm2 save
echo "PM2 Setup v3 Complete"
pm2 list
