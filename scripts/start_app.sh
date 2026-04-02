#!/bin/bash
cd /home/xg/stock-screener
pkill -9 node
sleep 1
nohup node server/index.js > server.log 2>&1 &
echo "App started in background."
