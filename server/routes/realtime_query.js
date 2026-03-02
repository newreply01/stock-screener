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
        // Order ascending (chronological) for charts and tables
        const sql = `
            SELECT 
                symbol, 
                TO_CHAR(trade_time AT TIME ZONE 'Asia/Taipei', 'HH24:MI:SS') as time_str,
                trade_time, 
                price, open_price, high_price, low_price, 
                volume, trade_volume, 
                buy_intensity, sell_intensity, five_levels
            FROM realtime_ticks
            WHERE symbol = $1 
              AND TO_CHAR(trade_time AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD') = $2
            ORDER BY trade_time ASC
        `;

        const result = await query(sql, [symbol, targetDate]);

        res.json({
            success: true,
            symbol: symbol,
            date: targetDate,
            data: result.rows
        });
    } catch (err) {
        console.error('Failed to fetch realtime ticks:', err);
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
