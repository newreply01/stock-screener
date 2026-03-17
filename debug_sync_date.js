const { Pool } = require('pg');
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'stock_screener',
    password: 'postgres123',
    port: 5432,
});

async function checkSyncProgress() {
    try {
        console.log("--- fm_sync_progress status for TaiwanStockTradingDate ---");
        const res = await pool.query(`
            SELECT * 
            FROM fm_sync_progress 
            WHERE dataset = 'TaiwanStockTradingDate'
        `);
        if (res.rows.length === 0) {
            console.log("No record found for TaiwanStockTradingDate in fm_sync_progress.");
        } else {
            console.table(res.rows);
        }

        const dateRes = await pool.query(`SELECT MAX(date) FROM trading_dates`);
        console.log("\nLatest date in trading_dates:", dateRes.rows[0].max);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkSyncProgress();
