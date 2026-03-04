const express = require('express');
const router = express.Router();
const { query } = require('../db');

// In-memory cache to keep track of the latest trade_time for each connection
// so we only send updates when new data arrives.

router.get('/realtime', async (req, res) => {
    const symbolsParam = req.query.symbols;
    if (!symbolsParam) {
        return res.status(400).json({ error: 'Missing symbols parameter' });
    }

    const symbols = symbolsParam.split(',').filter(Boolean);
    if (symbols.length === 0) {
        return res.status(400).json({ error: 'Empty symbols parameter' });
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Flush headers to establish connection
    res.flushHeaders();

    // Map to keep track of latest trade_time we've sent for each symbol
    const lastSentTime = {};

    let isClosed = false;

    // The polling function
    const pushData = async () => {
        if (isClosed) return;

        try {
            // Find the latest tick for each symbol requested
            // We use a simple query per symbol, or a combined IN query with ROW_NUMBER
            // A combined query is more efficient:

            const sql = `
                WITH LatestTicks AS (
                    SELECT 
                        t.symbol, t.trade_time, t.price, t.open_price, t.high_price, t.low_price, 
                        t.volume, t.trade_volume, t.buy_intensity, t.sell_intensity, t.five_levels,
                        s.name, s.industry,
                        (SELECT close_price FROM daily_prices dp WHERE dp.symbol = t.symbol AND dp.trade_date < DATE(t.trade_time) ORDER BY dp.trade_date DESC LIMIT 1) as previous_close,
                        ROW_NUMBER() OVER (PARTITION BY t.symbol ORDER BY t.trade_time DESC) as rn
                    FROM realtime_ticks t
                    LEFT JOIN stocks s ON t.symbol = s.symbol
                    WHERE t.symbol = ANY($1::varchar[])
                )
                SELECT * FROM LatestTicks WHERE rn = 1;
            `;

            const result = await query(sql, [symbols]);

            const updates = [];
            for (const row of result.rows) {
                const sym = row.symbol;
                const timeStr = new Date(row.trade_time).getTime();

                // If we haven't sent this tick yet, queue it for update
                if (!lastSentTime[sym] || lastSentTime[sym] < timeStr) {
                    lastSentTime[sym] = timeStr;
                    updates.push(row);
                }
            }

            if (updates.length > 0) {
                res.write(`data: ${JSON.stringify(updates)}\n\n`);
            }
        } catch (err) {
            console.error('[SSE Error]', err);
        }
    };

    // Send initial data immediately
    await pushData();

    // Poll every 3 seconds (realtime crawler updates every minute, but we check frequently for responsiveness)
    const intervalId = setInterval(pushData, 3000);

    req.on('close', () => {
        isClosed = true;
        clearInterval(intervalId);
        res.end();
    });
});

module.exports = router;
