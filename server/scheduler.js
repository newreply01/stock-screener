const cron = require('node-cron');
const { catchUp } = require('./fetcher');
const { syncAllNews } = require('./news_fetcher');
const { syncAllStocksFinancials } = require('./finmind_fetcher');
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
        isTaskRunning['fetcher.js'] = true;
        console.log(' 定時排程開始 (15:00)：抓取今日行情...');
        await logScriptStatus('fetcher.js', 'RUNNING', '正在執行盤後行情初步抓取');
        try {
            await catchUp();
            console.log(' (15:00) 今日行情抓取完成');
            await logScriptStatus('fetcher.js', 'SUCCESS', '盤後行情初步抓取完成');
        } catch (err) {
            console.error(' (15:00) 行情抓取失敗:', err.message);
            await logScriptStatus('fetcher.js', 'FAILED', `執行失敗: ${err.message}`);
        } finally {
            isTaskRunning['fetcher.js'] = false;
        }
    }, {
        scheduled: true,
        timezone: 'Asia/Taipei'
    });
    initTaskTracking('fetcher.js_1500', fetcherTask1500);

    // 每交易日 21:45 補抓籌碼資料 (三大法人、融資融券更新後)
    const fetcherTask2145 = cron.schedule('45 21 * * 1-5', async () => {
        isTaskRunning['fetcher.js'] = true;
        console.log(' 定時排程開始 (21:45)：補抓今日籌碼資料...');
        await logScriptStatus('fetcher.js', 'RUNNING', '正在補抓今日法人與資券資料');
        try {
            await catchUp();
            console.log(' (21:45) 今日籌碼資料補全完成');
            await logScriptStatus('fetcher.js', 'SUCCESS', '今日法人與資券補抓完成');
        } catch (err) {
            console.error(' (21:45) 籌碼補抓失敗:', err.message);
            await logScriptStatus('fetcher.js', 'FAILED', `補抓失敗: ${err.message}`);
        } finally {
            isTaskRunning['fetcher.js'] = false;
        }
    }, {
        scheduled: true,
        timezone: 'Asia/Taipei'
    });
    initTaskTracking('fetcher.js_2145', fetcherTask2145);

    // 每小時更新新聞
    const newsTask = cron.schedule('0 * * * *', async () => {
        isTaskRunning['news_fetcher.js'] = true;
        console.log(' 定時排程開始：更新新聞...');
        await logScriptStatus('news_fetcher.js', 'RUNNING', '正在執行每小時新聞更新');
        try {
            await syncAllNews();
            console.log(' 新聞更新完成');
            await logScriptStatus('news_fetcher.js', 'SUCCESS', '新聞更新完成');
        } catch (err) {
            console.error(' 新聞更新失敗:', err.message);
            await logScriptStatus('news_fetcher.js', 'FAILED', `更新失敗: ${err.message}`);
        } finally {
            isTaskRunning['news_fetcher.js'] = false;
        }
    }, {
        scheduled: true,
        timezone: 'Asia/Taipei'
    });
    initTaskTracking('news_fetcher.js', newsTask);

    // 每週六 04:00 更新基本面資料 (FinMind)
    const finmindTask = cron.schedule('0 4 * * 6', async () => {
        isTaskRunning['finmind_fetcher.js'] = true;
        console.log(' 定時排程開始：更新基本面資料...');
        await logScriptStatus('finmind_fetcher.js', 'RUNNING', '正在執行基本面資料更新');
        try {
            await syncAllStocksFinancials();
            console.log(' 基本面資料更新完成');
            await logScriptStatus('finmind_fetcher.js', 'SUCCESS', '基本面資料更新完成');
        } catch (err) {
            console.error(' 基本面更新失敗:', err.message);
            await logScriptStatus('finmind_fetcher.js', 'FAILED', `基本面更新失敗: ${err.message}`);
        } finally {
            isTaskRunning['finmind_fetcher.js'] = false;
        }
    }, {
        scheduled: true,
        timezone: 'Asia/Taipei'
    });
    initTaskTracking('finmind_fetcher.js', finmindTask);

    // 每交易日 15:30 第一次計算全股健診排行 (初步價格更新後)
    const healthTask1530 = cron.schedule('30 15 * * 1-5', async () => {
        isTaskRunning['calc_health_scores.js'] = true;
        console.log('🏥 定時排程開始 (15:30)：計算全股健診排行 (初步)...');
        await logScriptStatus('calc_health_scores.js', 'RUNNING', '正在計算初步全股健診排行');
        try {
            await runHealthCheck();
            console.log('🏥 (15:30) 全股健診排行計算完成');
            await logScriptStatus('calc_health_scores.js', 'SUCCESS', '初步健診排行計算完成');
        } catch (err) {
            console.error('🏥 (15:30) 健診排行計算失敗:', err.message);
            await logScriptStatus('calc_health_scores.js', 'FAILED', `初步計算失敗: ${err.message}`);
        } finally {
            isTaskRunning['calc_health_scores.js'] = false;
        }
    }, {
        scheduled: true,
        timezone: 'Asia/Taipei'
    });
    initTaskTracking('calc_health_scores.js_1530', healthTask1530);

    // 每交易日 15:45 計算技術指標 (價格同步後)
    const indicatorsTask = cron.schedule('45 15 * * 1-5', async () => {
        isTaskRunning['calculate_indicators.js'] = true;
        console.log('📈 定時排程開始 (15:45)：計算技術指標...');
        await logScriptStatus('calculate_indicators.js', 'RUNNING', '正在計算技術指標');
        try {
            await calculateAndStoreIndicators();
            console.log('📈 (15:45) 技術指標計算完成');
            await logScriptStatus('calculate_indicators.js', 'SUCCESS', '技術指標計算完成');
        } catch (err) {
            console.error('📈 (15:45) 技術指標計算失敗:', err.message);
            await logScriptStatus('calculate_indicators.js', 'FAILED', `計算失敗: ${err.message}`);
        } finally {
            isTaskRunning['calculate_indicators.js'] = false;
        }
    }, {
        scheduled: true,
        timezone: 'Asia/Taipei'
    });
    initTaskTracking('calculate_indicators.js', indicatorsTask);

    // 每交易日 22:15 第二次計算全股健診排行 (籌碼資料補全後)
    const healthTask2215 = cron.schedule('15 22 * * 1-5', async () => {
        isTaskRunning['calc_health_scores.js'] = true;
        console.log('🏥 定時排程開始 (22:15)：計算全股健診排行 (最終)...');
        await logScriptStatus('calc_health_scores.js', 'RUNNING', '正在計算最終全股健診排行');
        try {
            await runHealthCheck();
            console.log('🏥 (22:15) 全股健診排行計算完成');
            await logScriptStatus('calc_health_scores.js', 'SUCCESS', '最終健診排行計算完成');
        } catch (err) {
            console.error('🏥 (22:15) 健診排行計算失敗:', err.message);
            await logScriptStatus('calc_health_scores.js', 'FAILED', `最終計算失敗: ${err.message}`);
        } finally {
            isTaskRunning['calc_health_scores.js'] = false;
        }
    }, {
        scheduled: true,
        timezone: 'Asia/Taipei'
    });
    initTaskTracking('calc_health_scores.js_2215', healthTask2215);

    // 每交易日 16:30 補抓今日歷史 1 分K (盤後資料完整後執行)
    if (syncHistoricalMinuteBatch) {
        const histTickTask = cron.schedule('30 16 * * 1-5', async () => {
            isTaskRunning['historical_tick_sync.js'] = true;
            const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
            console.log(`📈 定時排程開始：補抓 ${today} 歷史 1 分K...`);
            await logScriptStatus('historical_tick_sync.js', 'RUNNING', `正在補抓 ${today} 歷史分時資料`);
            try {
                await syncHistoricalMinuteBatch(today, 100); // 今日，前 100 大股票
                console.log('📈 歷史 1 分K 補抓完成');
                await logScriptStatus('historical_tick_sync.js', 'SUCCESS', `${today} 歷史分時補抓完成`);
            } catch (err) {
                console.error('📈 歷史 1 分K 補抓失敗:', err.message);
                await logScriptStatus('historical_tick_sync.js', 'FAILED', `補抓失敗: ${err.message}`);
            } finally {
                isTaskRunning['historical_tick_sync.js'] = false;
            }
        }, {
            scheduled: true,
            timezone: 'Asia/Taipei'
        });
        initTaskTracking('historical_tick_sync.js', histTickTask);
    }

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

module.exports = { startScheduler, getLiveSchedulerStatus };
