const { pool } = require('./server/db');

async function checkRealtime() {
    try {
        const res = await pool.query(`SELECT COUNT(*) as count_today, MAX(trade_time) as latest_time FROM realtime_ticks WHERE trade_time >= CURRENT_DATE;`);
        const statusRes = await pool.query(`SELECT status, message, check_time FROM system_status WHERE service_name = 'realtime_crawler.js' ORDER BY check_time DESC LIMIT 1;`);

        console.log('--- 即時爬蟲資料庫狀態 ---');
        console.log('今日 (2026-03-05) 總筆數:', res.rows[0].count_today);
        console.log('最新資料時間:', res.rows[0].latest_time);

        console.log('\n--- 系統狀態表 (system_status) ---');
        if (statusRes.rows.length > 0) {
            console.log('狀態:', statusRes.rows[0].status);
            console.log('訊息:', statusRes.rows[0].message);
            console.log('更新時間:', statusRes.rows[0].check_time);
        } else {
            console.log('無狀態紀錄');
        }
    } catch (e) {
        console.error('查詢失敗:', e);
    } finally {
        pool.end();
    }
}

checkRealtime();
