const { query } = require('./db');

async function listDates() {
    try {
        const res = await query(`
            SELECT DISTINCT trade_date::text 
            FROM daily_prices 
            WHERE trade_date >= '2026-02-01' 
            ORDER BY trade_date DESC
        `);
        console.log('Available dates in daily_prices:');
        res.rows.forEach(r => console.log(r.trade_date));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

listDates();
