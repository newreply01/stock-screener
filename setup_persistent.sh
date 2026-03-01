#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /home/xg/stock-screener

# Kill any existing processes on these ports to be sure
fuser -k 3000/tcp 20000/tcp || true

echo "Starting backend..."
nohup node server/index.js > /home/xg/server_final.log 2>&1 &

echo "Starting frontend..."
cd client
nohup npm run dev -- --host > /home/xg/client_final.log 2>&1 &

echo "Services initiated in background"
