#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /home/xg/stock-screener
pm2 start server/realtime_crawler.js --name "realtime-crawler"
pm2 save
sleep 3
pm2 logs realtime-crawler --lines 30 --nostream
