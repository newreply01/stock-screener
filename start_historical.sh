#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

cd /home/xg/stock-screener
pm2 start server/historical_tick_sync.js --name "historical-backfill" -- --start=2025-01-01 --limit=2000
pm2 save
sleep 3
pm2 logs historical-backfill --lines 30 --nostream
