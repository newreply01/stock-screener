const express = require('express');
const router = express.Router();
const { pool } = require('../db');

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
            // 對應 FinMind 資料集名稱設定說明 (可依實際狀況調整)
            switch (row.dataset) {
                case 'TaiwanStockPrice':
                case 'TaiwanStockDayTrading':
                case 'TaiwanStockMarginPurchaseShortSale':
                case 'TaiwanStockInstitutionalInvestorsBuySell':
                case 'TaiwanFuturesDaily':
                case 'TaiwanOptionDaily':
                    description = '每交易日 15:30 更新';
                    break;
                case 'TaiwanStockNews':
                    description = '每小時更新';
                    break;
                case 'TaiwanStockFinancialStatements':
                case 'TaiwanStockBalanceSheet':
                case 'TaiwanStockCashFlowsStatement':
                case 'TaiwanStockMonthRevenue':
                case 'TaiwanStockDividend':
                    description = '每週六 04:00 更新';
                    break;
                default:
                    description = '定期檢查更新';
            }

            return {
                dataset: row.dataset,
                last_updated: row.last_updated,
                description: description
            };
        });

        res.json({
            success: true,
            status: {
                database: dbStatus,
                scheduler: schedulerStatus.status,
                scheduler_last_check: schedulerStatus.last_check,
                backend: 'UP' // 能到達這裡代表後端正常
            },
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
            SELECT trade_date, COUNT(*) as count 
            FROM daily_prices 
            WHERE trade_date >= CURRENT_DATE - INTERVAL '${days} days'
            GROUP BY trade_date 
            ORDER BY trade_date ASC
        `);

        // 2. 三大法人買賣資料筆數
        const instStatsRes = await pool.query(`
            SELECT trade_date, COUNT(*) as count 
            FROM institutional 
            WHERE trade_date >= CURRENT_DATE - INTERVAL '${days} days'
            GROUP BY trade_date 
            ORDER BY trade_date ASC
        `);

        // 3. 融資券資料筆數
        const marginStatsRes = await pool.query(`
            SELECT date as trade_date, COUNT(*) as count 
            FROM fm_margin_trading 
            WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
            GROUP BY date 
            ORDER BY date ASC
        `);

        // 整合資料，以日期為 key
        const statsMap = {};

        // 初始化近 N 天的日期
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            statsMap[dateStr] = { date: dateStr, price_count: 0, inst_count: 0, margin_count: 0 };
        }

        const formatStats = (rows, field) => {
            rows.forEach(r => {
                // 將 Date 物件轉為 YYYY-MM-DD 字串 (如果 db 吐回來的是 Date)
                const dStr = r.trade_date instanceof Date ? r.trade_date.toISOString().split('T')[0] : String(r.trade_date).substring(0, 10);
                if (statsMap[dStr]) {
                    statsMap[dStr][field] = parseInt(r.count, 10);
                }
            });
        };

        formatStats(priceStatsRes.rows, 'price_count');
        formatStats(instStatsRes.rows, 'inst_count');
        formatStats(marginStatsRes.rows, 'margin_count');

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
