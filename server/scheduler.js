const cron = require('node-cron');
const { catchUp } = require('./twse_fetcher');
const { syncAllNews } = require('./news_fetcher');
const { syncAllStocksFinancials, syncTradingDate, syncDailyStocksData } = require('./finmind_fetcher');
const { calculateAndStoreIndicators } = require('./calculate_indicators');
const { runAll: runHealthCheck } = require('./scripts/calc_health_scores');
let syncHistoricalMinuteBatch;
try {
    const histModule = require('./historical_tick_sync');
    syncHistoricalMinuteBatch = histModule.syncHistoricalMinuteBatch;
} catch (e) {
    console.warn('Optional module historical_tick_sync not found, skipping related tasks.');
}
const { pool } = require('./db');

async function logScriptStatus(serviceName, status, message) {
    try {
        await pool.query(
            `INSERT INTO system_status (service_name, status, message) VALUES ($1, $2, $3)`,
            [serviceName, status, message]
        );
    } catch (err) {
        console.error(`Failed to log script status for ${serviceName}:`, err.message);
    }
}

// 追蹤排程的即時運行狀態
const scheduledTasks = {};
const isTaskRunning = {};

function initTaskTracking(scriptName, task) {
    scheduledTasks[scriptName] = task;
    isTaskRunning[scriptName] = false;
}

function getLiveSchedulerStatus() {
    const statusMap = {};
    for (const [scriptName, task] of Object.entries(scheduledTasks)) {
        if (!task) {
            statusMap[scriptName] = 'NOT_SCHEDULED';
        } else if (isTaskRunning[scriptName]) {
            statusMap[scriptName] = 'RUNNING';
        } else {
            statusMap[scriptName] = 'WAITING'; // 排程已註冊，等待時間到
        }
    }
    return statusMap;
}

function startScheduler() {
    // 每交易日 15:00 更新行情 (初步價格同步)
    const fetcherTask1500 = cron.schedule('0 15 * * 1-5', async () => {
        console.log('📅 定時排程開始 (15:00)：抓取今日行情...');
        await runTaskSafely('twse_fetcher.js', catchUp, '盤後行情初步抓取');
    }, {
        scheduled: true,
        timezone: 'Asia/Taipei'
    });
    initTaskTracking('twse_fetcher.js_1500', fetcherTask1500);

    // 每交易日 21:45 補抓籌碼資料 (三大法人、融資融券更新後)
    const fetcherTask2145 = cron.schedule('45 21 * * 1-5', async () => {
        console.log('📅 定時排程開始 (21:45)：補抓今日籌碼資料...');
        await runTaskSafely('twse_fetcher.js', catchUp, '今日法人與資券補抓');
        const { syncTotalInstitutional, syncTotalMargin } = require('./finmind_fetcher');
        await runTaskSafely('finmind_total_institutional', syncTotalInstitutional, '大盤三大法人同步');
        await runTaskSafely('finmind_total_margin', syncTotalMargin, '大盤融資券同步');
    }, {
        scheduled: true,
        timezone: 'Asia/Taipei'
    });
    initTaskTracking('twse_fetcher.js_2145', fetcherTask2145);

    // 每小時更新新聞
    const newsTask = cron.schedule('0 * * * *', async () => {
        console.log('📰 定時排程開始：更新新聞...');
        await runTaskSafely('news_fetcher.js', syncAllNews, '每小時新聞更新');
    }, {
        scheduled: true,
        timezone: 'Asia/Taipei'
    });
    initTaskTracking('news_fetcher.js', newsTask);

    // 每週六 04:00 更新基本面資料 (FinMind)
    const finmindTask = cron.schedule('0 4 * * 6', async () => {
        console.log('🚀 定時排程開始：更新基本面資料...');
        await runTaskSafely('finmind_fetcher.js', syncAllStocksFinancials, '每週基本面更新');
    }, {
        scheduled: true,
        timezone: 'Asia/Taipei'
    });
    initTaskTracking('finmind_fetcher.js', finmindTask);

    // 每小時更新 FinMind 每日異動資料 (分點買賣、本益比、持股分級)
    const finmindDailyTask = cron.schedule('15 * * * *', async () => {
        console.log('🚀 定時排程開始：更新 FinMind 每日異動資料...');
        await runTaskSafely('finmind_fetcher.js', syncDailyStocksData, '每小時分點與籌碼更新');
    }, {
        scheduled: true,
        timezone: 'Asia/Taipei'
    });
    initTaskTracking('finmind_daily', finmindDailyTask);

    // 每日 04:00 同步交易日資訊 (FinMind)
    const tradingDateTask = cron.schedule('0 4 * * *', async () => {
        console.log('📅 定時排程開始 (04:00)：同步交易日資訊...');
        await runTaskSafely('finmind_fetcher.js', syncTradingDate, '每日交易日資訊同步');
    }, {
        scheduled: true,
        timezone: 'Asia/Taipei'
    });
    initTaskTracking('trading_date_sync', tradingDateTask);
    
    // 每月 1 日 04:30 更新券商分點資訊 (FinMind)
    const brokerTask = cron.schedule('30 4 1 * *', async () => {
        console.log('🏢 定時排程開始 (04:30)：更新券商分點資訊...');
        const { syncBrokers } = require('./finmind_fetcher');
        await runTaskSafely('finmind_brokers', syncBrokers, '每月券商資訊更新');
    }, {
        scheduled: true,
        timezone: 'Asia/Taipei'
    });
    initTaskTracking('finmind_brokers', brokerTask);

    // 每交易日 15:30 第一次計算全股健診排行 (初步價格更新後)
    const healthTask1530 = cron.schedule('30 15 * * 1-5', async () => {
        console.log('🏥 定時排程開始 (15:30)：計算全股健診排行 (初步)...');
        await runTaskSafely('calc_health_scores.js', runHealthCheck, '初步全股健診排行計算');
    }, {
        scheduled: true,
        timezone: 'Asia/Taipei'
    });
    initTaskTracking('calc_health_scores.js_1530', healthTask1530);

    // 每交易日 15:45 計算技術指標 (價格同步後)
    const indicatorsTask = cron.schedule('45 15 * * 1-5', async () => {
        console.log('📈 定時排程開始 (15:45)：計算技術指標...');
        await runTaskSafely('calculate_indicators.js', calculateAndStoreIndicators, '技術指標計算');
    }, {
        scheduled: true,
        timezone: 'Asia/Taipei'
    });
    initTaskTracking('calculate_indicators.js', indicatorsTask);

    // 每交易日 22:15 第二次計算全股健診排行 (籌碼資料補全後)
    const healthTask2215 = cron.schedule('15 22 * * 1-5', async () => {
        console.log('🏥 定時排程開始 (22:15)：計算全股健診排行 (最終)...');
        await runTaskSafely('calc_health_scores.js', runHealthCheck, '最終全股健診排行計算');
    }, {
        scheduled: true,
        timezone: 'Asia/Taipei'
    });
    initTaskTracking('calc_health_scores.js_2215', healthTask2215);

    // 每交易日 16:30 補抓今日歷史 1 分K (盤後資料完整後執行)
    if (syncHistoricalMinuteBatch) {
        const histTickTask = cron.schedule('30 16 * * 1-5', async () => {
            const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
            console.log(`📈 定時排程開始：補抓 ${today} 歷史 1 分K...`);
            await runTaskSafely('historical_tick_sync.js', async () => {
                await syncHistoricalMinuteBatch(today, 100);
            }, `${today} 歷史分時補抓`);
        }, {
            scheduled: true,
            timezone: 'Asia/Taipei'
        });
        initTaskTracking('historical_tick_sync.js', histTickTask);
    }

    // 每日 23:55 更新系統寫入統計表
    const statsUpdateTask = cron.schedule('55 23 * * *', async () => {
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
        console.log(`📊 定時排程開始 (23:55)：更新 ${todayStr} 系統寫入筆數統計...`);
        const { updateDailyStats } = require('./utils/statsAggregator');
        await runTaskSafely('updateDailyStats', async () => {
            await updateDailyStats(todayStr);
        }, '系統寫入統計表每日更新');
    }, {
        scheduled: true,
        timezone: 'Asia/Taipei'
    });
    initTaskTracking('update_ingestion_stats', statsUpdateTask);

    // 系統狀態監控 (每 5 分鐘執行一次)
    cron.schedule('*/5 * * * *', async () => {
        try {
            // 檢查資料庫是否存活
            await pool.query('SELECT 1');

            // 寫入健康紀錄
            await logScriptStatus('scheduler', 'UP', 'Scheduler is running normally');
        } catch (err) {
            console.error('系統狀態檢查失敗:', err.message);
        }
    });

    console.log(' 排程系統已啟動 (時區: Asia/Taipei)');
}

// 輔助函式：確保非同步任務在失敗時會紀錄狀態
async function runTaskSafely(taskName, taskFn, description) {
    if (isTaskRunning[taskName]) {
        console.log(`⚠️ 任務 ${taskName} 正正在執行中，跳過本次調度。`);
        return;
    }
    
    isTaskRunning[taskName] = true;
    await logScriptStatus(taskName, 'RUNNING', `正在執行: ${description}`);
    try {
        await taskFn();
        await logScriptStatus(taskName, 'SUCCESS', `${description}完成`);
    } catch (err) {
        console.error(`❌ 任務 ${taskName} 執行失敗:`, err.message);
        await logScriptStatus(taskName, 'FAILED', `執行失敗: ${err.message}`);
    } finally {
        isTaskRunning[taskName] = false;
    }
}

module.exports = { startScheduler, getLiveSchedulerStatus };
