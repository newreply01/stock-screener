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
        const scriptNames = ['twse_fetcher.js', 'news_fetcher.js', 'finmind_fetcher.js', 'calc_health_scores.js', 'realtime_crawler.js', 'updateDailyStats'];
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
            // 對應 FinMind 資料集名稱設定說明 (可依實際狀況調整)
            let description = ''; // 排程說明
            let usage = '';       // 資料用途說明
            let script = '';
            let name = row.dataset; // 友善名稱

            // 對應 FinMind 資料集名稱設定說明 (可依實際狀況調整)
            // 對應 FinMind 資料集名稱設定說明 (可依實際狀況調整)
            switch (row.dataset) {
                case 'TaiwanStockPrice':
                    name = '台股日K線';
                    usage = '收盤價、成交量、最高/最低價';
                    script = 'twse_fetcher.js';
                    description = '15:00 初步 / 21:45 補全';
                    break;
                case 'TaiwanStockDayTrading':
                    name = '當沖交易';
                    usage = '每日現股當沖買賣成交金額與股數';
                    script = 'twse_fetcher.js';
                    description = '15:00 初步 / 21:45 補全';
                    break;
                case 'TaiwanStockMarginPurchaseShortSale':
                    name = '融資融券 (個股)';
                    usage = '各別股票之信用交易餘額與增減';
                    script = 'twse_fetcher.js';
                    description = '15:00 初步 / 21:45 補全';
                    break;
                case 'TaiwanStockTotalMarginPurchaseShortSale':
                    name = '融資融券 (全市場)';
                    usage = '全市場（大盤）信用交易總額與增減';
                    script = 'finmind_fetcher.js';
                    description = '21:45 更新';
                    break;
                case 'TaiwanStockInstitutional':
                case 'TaiwanStockInstitutionalInvestorsBuySell':
                    name = '三大法人買賣超 (個股)';
                    usage = '各別股票之法人買賣金額與張數';
                    script = 'twse_fetcher.js';
                    description = '15:00 初步 / 21:45 補全';
                    break;
                case 'TaiwanStockTotalInstitutionalInvestors':
                    name = '三大法人買賣超 (全市場)';
                    usage = '全市場（大盤）法人買賣超總計';
                    script = 'finmind_fetcher.js';
                    description = '21:45 更新';
                    break;
                case 'TaiwanStockFinancialStatements':
                    name = '財務報表 (損益表)';
                    usage = '各別股票之損益表 (每季)';
                    script = 'finmind_fetcher.js';
                    description = '每週六 04:00 更新';
                    break;
                case 'TaiwanStockBalanceSheet':
                    name = '財務報表 (資產負債表)';
                    usage = '各別股票之資產負債表 (每季)';
                    script = 'finmind_fetcher.js';
                    description = '每週六 04:00 更新';
                    break;
                case 'TaiwanStockCashFlowsStatement':
                    name = '財務報表 (現金流量表)';
                    usage = '各別股票之現金流量表 (每季)';
                    script = 'finmind_fetcher.js';
                    description = '每週六 04:00 更新';
                    break;
                case 'TaiwanStockMonthRevenue':
                    name = '每月營收';
                    usage = '每月營收動態與 YoY 成長率';
                    script = 'finmind_fetcher.js';
                    description = '每小時 15 分偵測';
                    break;
                case 'TaiwanStockDividend':
                    name = '股利政策';
                    usage = '歷史配股配息日期與金額';
                    script = 'finmind_fetcher.js';
                    description = '每週六 04:00 更新';
                    break;
                case 'TaiwanStockBrokerTrading':
                    name = '分點進出';
                    usage = '各大證券分點個股買賣明細 (籌碼)';
                    script = 'finmind_fetcher.js';
                    description = '每小時 15 分 (600筆/hr)';
                    break;
                case 'TaiwanStockPER':
                    name = '評分/本益比';
                    usage = '日計本益比、本淨比與現金殖利率';
                    script = 'finmind_fetcher.js';
                    description = '每小時 15 分 (600筆/hr)';
                    break;
                case 'TaiwanStockHoldingSharesPer':
                    name = '股東持股分級';
                    usage = '大戶/散戶每週持股比例變動';
                    script = 'finmind_fetcher.js';
                    description = '每小時 15 分 (600筆/hr)';
                    break;
                case 'TaiwanStockInfo':
                    name = '個股基本資料';
                    usage = '產業分類、股本、上市日期等';
                    script = 'finmind_fetcher.js';
                    description = '每週六 04:00 更新';
                    break;
                case 'TaiwanStockNews':
                case 'News':
                    name = '財經新聞';
                    usage = '即時新聞推播與歷史查詢';
                    script = 'news_fetcher.js';
                    description = '每小時更新';
                    break;
                case 'TaiwanStockTotalReturnIndex':
                    name = '報酬指數';
                    usage = '大盤加權與報酬指數';
                    script = 'twse_fetcher.js';
                    description = '15:00 更新';
                    break;
                case 'TaiwanSecuritiesTraderInfo':
                    name = '證券商資訊';
                    usage = '券商代碼、名稱與分點基本資訊';
                    script = 'finmind_fetcher.js';
                    description = '每月 1 日更新';
                    break;
                case 'TaiwanStockDelisting':
                    name = '下市櫃資訊';
                    usage = '歷史已下市或合併之股份紀錄';
                    script = 'finmind_fetcher.js';
                    description = '每月更新';
                    break;
                case 'TaiwanStockTradingDate':
                    name = '交易日曆';
                    usage = '證交所開休市日期對照表';
                    script = 'finmind_fetcher.js';
                    description = '每年年初更新';
                    break;
                case 'FinMindDaily':
                    name = 'FinMind 綜合日更新';
                    usage = '綜合更新：分點進出、本益比、持股分級';
                    script = 'finmind_fetcher.js';
                    description = '每小時 (分點) / 每日 (持股)';
                    break;
                default:
                    script = '未知';
                    description = '背景自動擷取中';
                    usage = '相關個股數據';
            }

            return {
                id: row.dataset,
                dataset: name,
                usage: usage,
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
                    id: 'Realtime行情數據',
                    dataset: 'Realtime行情數據',
                    usage: '當前盤中即時報價與成交明細',
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
        const dateRes = await pool.query('SELECT CURRENT_DATE, NOW()');
        console.log(`[Monitor] DB Time: ${JSON.stringify(dateRes.rows[0])}, Node Time: ${new Date().toISOString()}`);

        const days = req.query.days || 14;

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
        console.log(`[Monitor] PriceStats rows: ${priceStatsRes.rows.length}`);

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
            SELECT date_str as trade_date_str, SUM(count) as count FROM (
                SELECT TO_CHAR(trade_time, 'YYYY-MM-DD') as date_str, COUNT(*) as count FROM realtime_ticks WHERE trade_time >= CURRENT_DATE - INTERVAL '${days} days' GROUP BY date_str
                UNION ALL
                SELECT TO_CHAR(trade_time, 'YYYY-MM-DD') as date_str, COUNT(*) as count FROM realtime_ticks_history WHERE trade_time >= CURRENT_DATE - INTERVAL '${days} days' GROUP BY date_str
            ) t GROUP BY date_str ORDER BY date_str ASC
        `);
        console.log(`[Monitor] RealtimeStats rows: ${realtimeStatsRes.rows.length}`);

        // 6. 全市場統計類 (整合當沖、期權、全市場統計)
        const extraStatsRes = await pool.query(`
            SELECT date_str, SUM(count) as total_count FROM (
                SELECT TO_CHAR(date, 'YYYY-MM-DD') as date_str, COUNT(*) as count FROM fm_day_trading WHERE date >= CURRENT_DATE - INTERVAL '${days} days' GROUP BY date_str
                UNION ALL
                SELECT TO_CHAR(date, 'YYYY-MM-DD') as date_str, COUNT(*) as count FROM fm_total_institutional WHERE date >= CURRENT_DATE - INTERVAL '${days} days' GROUP BY date_str
                UNION ALL
                SELECT TO_CHAR(date, 'YYYY-MM-DD') as date_str, COUNT(*) as count FROM fm_total_margin WHERE date >= CURRENT_DATE - INTERVAL '${days} days' GROUP BY date_str
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
