#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /home/xg/stock-screener
echo "Installing dependencies..."
npm install express cors dotenv pg node-cron
echo "Starting backend..."
nohup node server/index.js > /home/xg/server_final.log 2>&1 &
echo "Done"
