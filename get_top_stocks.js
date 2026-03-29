const { pool } = require('./server/db');
(async () => {
    try {
        const res = await pool.query(" SELECT symbol FROM daily_prices WHERE trade_date = 2026-03-27 ORDER BY volume DESC LIMIT 50)
