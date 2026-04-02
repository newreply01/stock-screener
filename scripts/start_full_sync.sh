#!/bin/bash
# Fix CRLF
sed -i 's/\r$//' /home/xg/stock-screener/.env
sed -i 's/\r$//' /home/xg/stock-screener/server/finmind_full_sync.js

cd /home/xg/stock-screener
export PATH=/home/xg/.nvm/versions/node/v22.22.0/bin:/usr/bin:/usr/local/bin:$PATH
set -a; source .env; set +a

# Start sync with increased memory limit
nohup node --max-old-space-size=4096 server/finmind_full_sync.js >> /home/xg/stock-screener/finmind_full_sync.log 2>&1 &
SYNC_PID=$!
echo "Started with PID: $SYNC_PID"
echo "PID: $SYNC_PID" >> /home/xg/stock-screener/finmind_full_sync.log

# Wait a few seconds and check if still running
sleep 5
if kill -0 $SYNC_PID 2>/dev/null; then
    echo "Process is running OK (PID: $SYNC_PID)"
else
    echo "ERROR: Process exited! Check log:"
    cat /home/xg/stock-screener/finmind_full_sync.log
fi
