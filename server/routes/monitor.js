const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { getLiveSchedulerStatus } = require('../scheduler');

// --- 監控系統 API ---

/**
 * GET /api/monitor/status
 * 取得系統服務狀態及資料擷取進度
 */
router.get('/status', async (req, res) => {
    try {
        // 1. 資料庫連線狀態 (簡單查詢)
        let dbStatus = 'DOWN';
        try {
            const dbRes = await pool.query('SELECT 1 as is_alive');
            if (dbRes.rows.length > 0 && dbRes.rows[0].is_alive === 1) {
                dbStatus = 'UP';
            }
        } catch (dbErr) {
            console.error('Monitor DB Check Error:', dbErr);
        }

        // 2. 系統排程健康狀態 (由 scheduler 寫入)
        let schedulerStatus = { status: 'UNKNOWN', last_check: null };
        try {
            const sysRes = await pool.query(
                `SELECT status, check_time 
                 FROM system_status 
                 WHERE service_name = 'scheduler' 
                 ORDER BY check_time DESC LIMIT 1`
            );
            if (sysRes.rows.length > 0) {
                schedulerStatus = {
                    status: sysRes.rows[0].status,
                    last_check: sysRes.rows[0].check_time
                };
            }
        } catch (sysErr) {
            // 忽略錯誤，可能是 table 還沒建好
        }

        // 2.5 取得各個 JS 程式的最後執行狀態 + 記憶體中即時狀態
        const liveStatusMap = getLiveSchedulerStatus ? getLiveSchedulerStatus() : {};
        const scriptNames = ['twse_fetcher.js', 'news_fetcher.js', 'finmind_fetcher.js', 'calc_health_scores.js', 'realtime_crawler.js'];
        const scriptStatusList = [];

        try {
            for (const sName of scriptNames) {
                // 從資料庫取得該排程「歷史最後一次紀錄」
                const sRes = await pool.query(
                    `SELECT status, message, check_time 
                     FROM system_status 
                     WHERE service_name = $1 
                     ORDER BY check_time DESC LIMIT 1`, [sName]
                );

                // 取得記憶體中，該排程此刻真實狀況
                const liveStatus = liveStatusMap[sName] || 'UNKNOWN';

                if (sRes.rows.length > 0) {
                    scriptStatusList.push({
                        script: sName,
                        live_status: liveStatus,
                        db_last_status: sRes.rows[0].status,
                        message: sRes.rows[0].message,
                        last_run: sRes.rows[0].check_time
                    });
                } else {
                    scriptStatusList.push({
                        script: sName,
                        live_status: liveStatus,
                        db_last_status: 'UNKNOWN',
                        message: '尚無執行紀錄',
                        last_run: null
                    });
                }
            }
        } catch (sysErr) {
            console.error('Monitor Script Check Error:', sysErr);
        }

        // 3. 各項資料最新同步進度
        const progressRes = await pool.query(`
            SELECT dataset, MAX(last_sync_date) as last_updated
            FROM fm_sync_progress
            GROUP BY dataset
            ORDER BY dataset
        `);

        // 將資料轉成前端好用的格式，並加上排程說明
        const syncDetails = progressRes.rows.map(row => {
            let description = '';
            let script = '';
            // 對應 FinMind 資料集名稱設定說明 (可依實際狀況調整)
            switch (row.dataset) {
                // 盤後行情 / 籌碼 / 期貨
                case 'TaiwanStockPrice':
                case 'TaiwanStockDayTrading':
                case 'TaiwanStockMarginPurchaseShortSale':
                case 'TaiwanStockInstitutional':
                case 'TaiwanStockInstitutionalInvestorsBuySell':
                case 'TaiwanStockTotalInstitutionalInvestors':
                case 'TaiwanStockTotalMarginPurchaseShortSale':
                case 'TaiwanFuturesDaily':
                case 'TaiwanOptionDaily':
                case 'TaiwanFutOptDailyInfo':
                case 'TaiwanSecuritiesTraderInfo':
                case 'TaiwanFuturesInstitutionalInvestors':
                case 'TaiwanOptionInstitutionalInvestors':
                    script = 'twse_fetcher.js';
                    description = '15:00 初步 / 21:45 補全';
                    break;
                // 新聞
                case 'News':
                case 'TaiwanStockNews':
                    script = 'news_fetcher.js';
                    description = '每小時更新';
                    break;
                // 基本面 / 靜態資訊
                case 'TaiwanStockFinancialStatements':
                case 'TaiwanStockBalanceSheet':
                case 'TaiwanStockCashFlowsStatement':
                case 'TaiwanStockMonthRevenue':
                case 'TaiwanStockDividend':
                case 'TaiwanStockInfo':
                case 'TaiwanStockDelisting':
                    script = 'finmind_fetcher.js';
                    description = '每週六 04:00 更新';
                    break;
                case 'TaiwanStockBrokerTrading':
                case 'TaiwanStockPER':
                case 'TaiwanStockHoldingSharesPer':
                case 'FinMindDaily':
                    script = 'finmind_fetcher.js';
                    description = '每小時 15 分 (600筆/hr)';
                    break;
                case 'TaiwanStockTradingDate':
                    script = 'finmind_fetcher.js';
                    description = '每日 04:00 更新';
                    break;
                default:
                    script = '未知';
                    description = '15:00 初步 / 21:45 補全';
            }

            return {
                dataset: row.dataset,
                last_updated: row.last_updated,
                script: script,
                description: description
            };
        });

        // 3.5 手動加入「即時數據」同步狀態 (因為它不在 fm_sync_progress 中)
        try {
            const rtRes = await pool.query('SELECT MAX(trade_time) as last_tick FROM realtime_ticks');
            if (rtRes.rows.length > 0 && rtRes.rows[0].last_tick) {
                syncDetails.unshift({
                    dataset: 'Realtime行情數據',
                    last_updated: rtRes.rows[0].last_tick,
                    script: 'realtime_crawler.js',
                    description: '盤中每數秒更新'
                });
            }
        } catch (rtErr) {
            console.error('Monitor Realtime Check Error:', rtErr);
        }

        res.json({
            success: true,
            status: {
                database: dbStatus,
                scheduler: schedulerStatus.status,
                scheduler_last_check: schedulerStatus.last_check,
                backend: 'UP' // 能到達這裡代表後端正常
            },
            script_status: scriptStatusList,
            sync_progress: syncDetails
        });

    } catch (err) {
        console.error('Monitor status error:', err);
        res.status(500).json({ success: false, error: 'Failed to retrieve monitor status' });
    }
});

/**
 * GET /api/monitor/ingestion-stats
 * 取得最近 14 天的資料寫入筆數統計
 */
router.get('/ingestion-stats', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 14;

        // 由於我們可能沒有在所有資料表紀錄 inserted_at，
        // 一個變通方式是直接用 trade_date / date 欄位來統計該日期的資料筆數。
        // （這代表「該交易日有幾筆資料」，與準確的「系統今天寫入幾筆」略有不同，
        // 但足以監控資料是否有順利進來）

        // 1. 收盤價資料筆數
        const priceStatsRes = await pool.query(`
            SELECT TO_CHAR(trade_date, 'YYYY-MM-DD') as trade_date_str, COUNT(*) as count 
            FROM daily_prices 
            WHERE trade_date >= CURRENT_DATE - INTERVAL '${days} days'
            GROUP BY trade_date_str 
            ORDER BY trade_date_str ASC
        `);

        // 2. 三大法人買賣資料筆數
        const instStatsRes = await pool.query(`
            SELECT TO_CHAR(trade_date, 'YYYY-MM-DD') as trade_date_str, COUNT(*) as count 
            FROM institutional 
            WHERE trade_date >= CURRENT_DATE - INTERVAL '${days} days'
            GROUP BY trade_date_str 
            ORDER BY trade_date_str ASC
        `);

        // 3. 融資券資料筆數
        const marginStatsRes = await pool.query(`
            SELECT TO_CHAR(date, 'YYYY-MM-DD') as trade_date_str, COUNT(*) as count 
            FROM fm_margin_trading 
            WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
            GROUP BY trade_date_str 
            ORDER BY trade_date_str ASC
        `);

        // 4. 財經新聞
        const newsStatsRes = await pool.query(`
            SELECT TO_CHAR(publish_at, 'YYYY-MM-DD') as trade_date_str, COUNT(*) as count
            FROM news
            WHERE publish_at >= CURRENT_DATE - INTERVAL '${days} days'
            GROUP BY trade_date_str
            ORDER BY trade_date_str ASC
        `);

        // 整合資料，以日期為 key
        const statsMap = {};

        // 初始化近 N 天的日期 (盡量避免時區問題，手動建立字串)
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            // 在 JS 中減去天數
            d.setDate(d.getDate() - i);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const dateStr = `${yyyy}-${mm}-${dd}`;

            statsMap[dateStr] = {
                date: dateStr,
                price_count: 0,
                inst_count: 0,
                margin_count: 0,
                news_count: 0,
                realtime_count: 0,
                stats_count: 0,
                health_count: 0
            };
        }

        // 5. 即時行情 (筆數較大)
        const realtimeStatsRes = await pool.query(`
            SELECT TO_CHAR(trade_time, 'YYYY-MM-DD') as trade_date_str, COUNT(*) as count 
            FROM realtime_ticks 
            WHERE trade_time >= CURRENT_DATE - INTERVAL '${days} days'
            GROUP BY trade_date_str 
            ORDER BY trade_date_str ASC
        `);

        // 6. 全市場統計類 (整合當沖、期權、全市場統計)
        const extraStatsRes = await pool.query(`
            SELECT date_str, SUM(count) as total_count FROM (
                SELECT TO_CHAR(date, 'YYYY-MM-DD') as date_str, COUNT(*) as count FROM fm_day_trading WHERE date >= CURRENT_DATE - INTERVAL '${days} days' GROUP BY date_str
                UNION ALL
                SELECT TO_CHAR(date, 'YYYY-MM-DD') as date_str, COUNT(*) as count FROM fm_total_institutional WHERE date >= CURRENT_DATE - INTERVAL '${days} days' GROUP BY date_str
                UNION ALL
                SELECT TO_CHAR(date, 'YYYY-MM-DD') as date_str, COUNT(*) as count FROM fm_total_margin WHERE date >= CURRENT_DATE - INTERVAL '${days} days' GROUP BY date_str
                UNION ALL
                SELECT TO_CHAR(date, 'YYYY-MM-DD') as date_str, COUNT(*) as count FROM fm_futures_daily WHERE date >= CURRENT_DATE - INTERVAL '${days} days' GROUP BY date_str
                UNION ALL
                SELECT TO_CHAR(date, 'YYYY-MM-DD') as date_str, COUNT(*) as count FROM fm_option_daily WHERE date >= CURRENT_DATE - INTERVAL '${days} days' GROUP BY date_str
            ) t GROUP BY date_str
        `);

        // 7. 健診分數計算
        const healthStatsRes = await pool.query(`
            SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as trade_date_str, COUNT(*) as count
            FROM stock_health_scores
            WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
            GROUP BY trade_date_str
            ORDER BY trade_date_str ASC
        `);

        const formatStats = (rows, field) => {
            rows.forEach(r => {
                const dStr = r.trade_date_str || r.date_str;
                if (statsMap[dStr]) {
                    statsMap[dStr][field] = parseInt(r.count || r.total_count, 10);
                }
            });
        };

        formatStats(priceStatsRes.rows, 'price_count');
        formatStats(instStatsRes.rows, 'inst_count');
        formatStats(marginStatsRes.rows, 'margin_count');
        formatStats(newsStatsRes.rows, 'news_count');
        formatStats(realtimeStatsRes.rows, 'realtime_count');
        formatStats(extraStatsRes.rows, 'stats_count');
        formatStats(healthStatsRes.rows, 'health_count');

        // 轉為陣列
        const statsArray = Object.values(statsMap).sort((a, b) => a.date.localeCompare(b.date));

        res.json({
            success: true,
            data: statsArray
        });

    } catch (err) {
        console.error('Monitor ingestion stats error:', err);
        res.status(500).json({ success: false, error: 'Failed to retrieve ingestion stats' });
    }
});

module.exports = router;
