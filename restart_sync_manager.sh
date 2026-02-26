#!/bin/bash
# Sync Manager - Segmented execution for stability
cd /home/xg/stock-screener
export PATH=/home/xg/.nvm/versions/node/v22.22.0/bin:/usr/bin:/usr/local/bin:$PATH
set -a; source .env; set +a

LOG_FILE="/home/xg/stock-screener/finmind_full_sync.log"

run_sync() {
    local phase=$1
    local limit=$2
    local label=$3
    echo "[$(date)] >>> Starting: $label (Phase $phase, Limit $limit)" | tee -a $LOG_FILE
    node --max-old-space-size=4096 server/finmind_full_sync.js --phase=$phase --limit=$limit >> $LOG_FILE 2>&1
    echo "[$(date)] <<< Finished: $label (Code: $?)" | tee -a $LOG_FILE
}

echo "====================================================" | tee -a $LOG_FILE
echo "🚀 [MANAGER] Starting Optimized Segmented Sync" | tee -a $LOG_FILE
echo "====================================================" | tee -a $LOG_FILE

# Phase 1: Global datasets (always run full)
run_sync 1 9999 "Phase 1: Global Datasets"

# Phase 2: Stock Price (Chunks of 200)
for i in {1..15}; do
    run_sync 2 200 "Phase 2: Technical/StockPrice Batch $i"
    sleep 5
done

# Phase 3: Financial Statements (Chunks of 100)
for i in {1..25}; do
    run_sync 3 100 "Phase 3: Fundamentals Batch $i"
    sleep 5
done

# Phase 4-6: Remaining (Run normally)
run_sync 4 9999 "Phase 4: Institutional"
run_sync 5 9999 "Phase 5: Futures/Options"
run_sync 6 9999 "Phase 6: News"

echo "✅ [MANAGER] All planned segments finished." | tee -a $LOG_FILE
