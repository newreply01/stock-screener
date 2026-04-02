#!/bin/bash
export PGPASSWORD=postgres123
psql -h 127.0.0.1 -p 5533 -U postgres -d stock_screener -c "
-- 1. 刪除所有內容過短的報告
DELETE FROM ai_reports 
WHERE length(content) < 100 
AND report_date = '2026-03-30';

-- 2. 重置隊列：將 3/30 只有空報告的標的設回 pending 且 retry_count 歸零
-- 我們抓出剛才被刪除的標的，以及用戶回報的 6770 與 009816
UPDATE ai_generation_queue 
SET status = 'pending', retry_count = 0 
WHERE report_date = '2026-03-30' 
AND (
    symbol = '6770' 
    OR symbol = '009816' 
    OR symbol NOT IN (SELECT symbol FROM ai_reports WHERE report_date = '2026-03-30')
);
"
