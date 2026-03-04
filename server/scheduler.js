const cron = require('node-cron');
const { catchUp } = require('./fetcher');
const { syncAllNews } = require('./news_fetcher');
const { syncAllStocksFinancials } = require('./finmind_fetcher');
const { runAll: runHealthCheck } = require('./scripts/calc_health_scores');

function startScheduler() {
    // 每交易日 15:30 更新行情 (台股收盤後)
    cron.schedule('30 15 * * 1-5', async () => {
        console.log(' 定時排程開始：抓取今日行情...');
        try {
            await catchUp();
            console.log(' 今日行情抓取完成');
        } catch (err) {
            console.error(' 行情抓取失敗:', err.message);
        }
    }, {
        scheduled: true,
        timezone: 'Asia/Taipei'
    });

    // 每小時更新新聞
    cron.schedule('0 * * * *', async () => {
        console.log(' 定時排程開始：更新新聞...');
        try {
            await syncAllNews();
            console.log(' 新聞更新完成');
        } catch (err) {
            console.error(' 新聞更新失敗:', err.message);
        }
    }, {
        scheduled: true,
        timezone: 'Asia/Taipei'
    });

    // 每週六 04:00 更新基本面資料 (FinMind)
    cron.schedule('0 4 * * 6', async () => {
        console.log(' 定時排程開始：更新基本面資料...');
        try {
            await syncAllStocksFinancials();
            console.log(' 基本面資料更新完成');
        } catch (err) {
            console.error(' 基本面更新失敗:', err.message);
        }
    }, {
        scheduled: true,
        timezone: 'Asia/Taipei'
    });

    // 每交易日 16:00 計算全股健診排行 (catchUp 15:30 完成後)
    cron.schedule('0 16 * * 1-5', async () => {
        console.log('🏥 定時排程開始：計算全股健診排行...');
        try {
            await runHealthCheck();
            console.log('🏥 全股健診排行計算完成');
        } catch (err) {
            console.error('🏥 健診排行計算失敗:', err.message);
        }
    }, {
        scheduled: true,
        timezone: 'Asia/Taipei'
    });

    // 系統狀態監控 (每 5 分鐘執行一次)
    cron.schedule('*/5 * * * *', async () => {
        try {
            const { pool } = require('./db');
            // 檢查資料庫是否存活
            await pool.query('SELECT 1');

            // 寫入健康紀錄
            await pool.query(
                `INSERT INTO system_status (service_name, status, message) 
                 VALUES ($1, $2, $3)`,
                ['scheduler', 'UP', 'Scheduler is running normally']
            );
        } catch (err) {
            console.error('系統狀態檢查失敗:', err.message);
        }
    });

    console.log(' 排程系統已啟動 (時區: Asia/Taipei)');
}

module.exports = { startScheduler };
