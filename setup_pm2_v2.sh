#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

echo "Installing PM2..."
npm install -g pm2

cd /home/xg/stock-screener
pm2 delete all || true

echo "Starting backend..."
pm2 start server/index.js --name backend

echo "Starting frontend..."
cd client
pm2 start "npm run dev -- --host --port 20000" --name frontend

pm2 save
echo "PM2 Setup Complete"
pm2 list
