const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/realtime-ticks?symbol=2330&date=2026-03-02
router.get('/realtime-ticks', async (req, res) => {
    try {
        const { symbol, date } = req.query;

        if (!symbol) {
            return res.status(400).json({ success: false, message: 'Missing symbol parameter' });
        }

        // 如果沒有提供日期，先尋找最新的日期
        let targetDate = date;
        if (!targetDate) {
            // 先從 Hot Table 找
            const hotDateRes = await query(`SELECT TO_CHAR(MAX(trade_time AT TIME ZONE 'Asia/Taipei'), 'YYYY-MM-DD') as max_date FROM realtime_ticks WHERE symbol = $1`, [symbol]);
            targetDate = hotDateRes.rows[0]?.max_date;
            
            // 如果 Hot Table 沒資料，再往 History 找
            if (!targetDate) {
                const histDateRes = await query(`SELECT TO_CHAR(MAX(trade_time AT TIME ZONE 'Asia/Taipei'), 'YYYY-MM-DD') as max_date FROM realtime_ticks_history WHERE symbol = $1`, [symbol]);
                targetDate = histDateRes.rows[0]?.max_date;
            }

            if (!targetDate) {
                return res.json({ success: true, data: [], date: null });
            }
        }

        // 判斷該從哪張表讀取 (優先檢查 Hot Table 是否有該日期的資料)
        let tableName = 'realtime_ticks_history';
        const checkHotRes = await query(`SELECT 1 FROM realtime_ticks WHERE (trade_time AT TIME ZONE 'Asia/Taipei')::date = $1::date LIMIT 1`, [targetDate]);
        if (checkHotRes.rows.length > 0) {
            tableName = 'realtime_ticks';
        }

        // Query ticks for that entire day (Taipei time)
        // Join with stocks to get name and industry
        const sql = `
            SELECT 
                t.symbol, s.name, s.industry,
                TO_CHAR(t.trade_time, 'HH24:MI:SS') as time_str,
                t.trade_time, 
                t.price, t.open_price, t.high_price, t.low_price, 
                t.volume, t.trade_volume, 
                t.buy_intensity, t.sell_intensity, t.five_levels,
                COALESCE(
                    NULLIF(t.previous_close, 0),
                    CASE 
                        WHEN (t.trade_time AT TIME ZONE 'Asia/Taipei')::date = sn.last_update THEN sn.yest_close 
                        WHEN (t.trade_time AT TIME ZONE 'Asia/Taipei')::date > sn.last_update THEN sn.today_close
                        ELSE (SELECT close_price FROM daily_prices dp WHERE dp.symbol = t.symbol AND dp.trade_date < (t.trade_time AT TIME ZONE 'Asia/Taipei')::date ORDER BY dp.trade_date DESC LIMIT 1)
                    END
                ) as previous_close
            FROM ${tableName} t
            LEFT JOIN stocks s ON t.symbol = s.symbol
            LEFT JOIN snapshot_last_close sn ON t.symbol = sn.symbol
            WHERE t.symbol = $1 
              AND (t.trade_time AT TIME ZONE 'Asia/Taipei')::date = $2::date
            ORDER BY t.trade_time ASC
        `;

        const result = await query(sql, [symbol, targetDate]);
        const stockInfo = result.rows.length > 0 ? {
            name: result.rows[0].name,
            industry: result.rows[0].industry
        } : { name: '', industry: '' };

        res.json({
            success: true,
            symbol: symbol,
            ...stockInfo,
            date: targetDate,
            data: result.rows
        });
    } catch (err) {
        console.error('Failed to fetch realtime ticks:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/realtime-active
router.get('/realtime-active', async (req, res) => {
    try {
        const topRes = await query(`
            SELECT symbol, COUNT(*) as ticks_count 
            FROM realtime_ticks 
            GROUP BY symbol 
            ORDER BY ticks_count DESC 
            LIMIT 10
        `);

        res.json({
            success: true,
            data: topRes.rows
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/debug/audit-crawler (Internal Audit)
router.get('/debug/audit-crawler', async (req, res) => {
    try {
        const total = await query('SELECT (SELECT COUNT(*) FROM realtime_ticks) + (SELECT COUNT(*) FROM realtime_ticks_history) as count');
        const byDate = await query(`
            SELECT date, SUM(count) as count FROM (
                SELECT TO_CHAR(DATE(trade_time AT TIME ZONE 'Asia/Taipei'), 'YYYY-MM-DD') as date, COUNT(*) as count FROM realtime_ticks GROUP BY 1
                UNION ALL
                SELECT TO_CHAR(DATE(trade_time AT TIME ZONE 'Asia/Taipei'), 'YYYY-MM-DD') as date, COUNT(*) as count FROM realtime_ticks_history GROUP BY 1
            ) s
            GROUP BY date ORDER BY date DESC LIMIT 20
        `);
        const latestRow = await query('SELECT MAX(trade_time) as max_time FROM (SELECT MAX(trade_time) as trade_time FROM realtime_ticks UNION ALL SELECT MAX(trade_time) FROM realtime_ticks_history) s');
        const uniqueSymbols = await query('SELECT COUNT(DISTINCT symbol) as count FROM realtime_ticks');

        res.json({
            success: true,
            total_records: parseInt(total.rows[0].count),
            latest_data_time: latestRow.rows[0].max_time,
            unique_symbols: parseInt(uniqueSymbols.rows[0].count),
            daily_breakdown: byDate.rows
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/realtime/:symbol - 獲取個股即時快照數據
router.get('/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
const sql = `
            SELECT 
                t.*,
                s.name,
                TO_CHAR(t.trade_time, 'HH24:MI:SS') as time_str,
                COALESCE(
                    NULLIF(t.previous_close, 0),
                    CASE 
                        WHEN DATE(t.trade_time) = sn.last_update THEN sn.yest_close 
                        WHEN DATE(t.trade_time) > sn.last_update THEN sn.today_close
                        ELSE (SELECT close_price FROM daily_prices dp WHERE dp.symbol = t.symbol AND dp.trade_date < DATE(t.trade_time) ORDER BY dp.trade_date DESC LIMIT 1)
                    END
                ) as previous_close
            FROM (
                SELECT * FROM realtime_ticks WHERE symbol = $1
                UNION ALL
                SELECT * FROM realtime_ticks_history WHERE symbol = $1
            ) t
            LEFT JOIN stocks s ON t.symbol = s.symbol
            LEFT JOIN snapshot_last_close sn ON t.symbol = sn.symbol
            WHERE t.symbol = $1
            ORDER BY t.trade_time DESC
            LIMIT 1
        `;
        const result = await query(sql, [symbol]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'No data found' });
        }
        
        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
