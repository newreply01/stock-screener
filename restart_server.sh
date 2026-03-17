#!/bin/bash
pkill -9 node
pkill -9 nodemon
sleep 2
cd /home/xg/stock-screener
nohup node server/index.js > server.log 2>&1 &
echo "Server restarted in background."
