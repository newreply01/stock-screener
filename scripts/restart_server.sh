#!/bin/bash
cd /home/xg/stock-screener
pkill -9 node || true
sleep 2
export PORT=31000
export ENABLE_CRAWLER=true
mkdir -p logs
setsid /usr/bin/node server/index.js > logs/server.log 2>&1 &
setsid /usr/bin/node server/realtime_crawler.js > logs/crawler.log 2>&1 &
echo "Server and Crawler restarted on port $PORT."
