#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
PM2_BIN="/home/xg/.nvm/versions/node/v25.7.0/bin/pm2"

cd /home/xg/stock-screener
$PM2_BIN delete all || true

echo "Starting backend..."
$PM2_BIN start server/index.js --name backend

echo "Starting frontend..."
cd client
$PM2_BIN start "npm run dev -- --host --port 20000" --name frontend

$PM2_BIN save
echo "PM2 Setup Complete"
$PM2_BIN list
