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

        // If no date provided, find the most recent date available in the ticks
        let targetDate = date;
        if (!targetDate) {
            const dateRes = await query(`
                SELECT TO_CHAR(MAX(trade_time AT TIME ZONE 'Asia/Taipei'), 'YYYY-MM-DD') as max_date 
                FROM realtime_ticks 
                WHERE symbol = $1
            `, [symbol]);

            targetDate = dateRes.rows[0]?.max_date;
            if (!targetDate) {
                return res.json({ success: true, data: [], date: null });
            }
        }

        // Query ticks for that entire day (Taipei time)
        // Join with stocks to get name and industry
        const sql = `
            SELECT 
                t.symbol, s.name, s.industry,
                TO_CHAR(t.trade_time AT TIME ZONE 'Asia/Taipei', 'HH24:MI:SS') as time_str,
                t.trade_time, 
                t.price, t.open_price, t.high_price, t.low_price, 
                t.volume, t.trade_volume, 
                t.buy_intensity, t.sell_intensity, t.five_levels,
                (SELECT close_price FROM daily_prices dp WHERE dp.symbol = t.symbol AND dp.trade_date < DATE($2) ORDER BY dp.trade_date DESC LIMIT 1) as previous_close
            FROM realtime_ticks t
            LEFT JOIN stocks s ON t.symbol = s.symbol
            WHERE t.symbol = $1 
              AND TO_CHAR(t.trade_time AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD') = $2
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
            WHERE DATE(trade_time AT TIME ZONE 'Asia/Taipei') = CURRENT_DATE
               OR DATE(trade_time AT TIME ZONE 'Asia/Taipei') = (SELECT TO_CHAR(MAX(trade_time AT TIME ZONE 'Asia/Taipei'), 'YYYY-MM-DD')::date FROM realtime_ticks)
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
        const total = await query('SELECT COUNT(*) FROM realtime_ticks');
        const byDate = await query(`
            SELECT 
                TO_CHAR(DATE(trade_time AT TIME ZONE 'Asia/Taipei'), 'YYYY-MM-DD') as date, 
                COUNT(*) as count 
            FROM realtime_ticks 
            GROUP BY DATE(trade_time AT TIME ZONE 'Asia/Taipei') 
            ORDER BY date DESC 
            LIMIT 10
        `);
        const latestRow = await query('SELECT MAX(trade_time) as max_time FROM realtime_ticks');
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

module.exports = router;
