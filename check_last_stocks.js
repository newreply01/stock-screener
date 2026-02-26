const { pool } = require('./server/db');
async function q() {
    try {
        const p = await pool.query("SELECT stock_id, last_sync_date FROM fm_sync_progress WHERE dataset='TaiwanStockPrice' ORDER BY last_sync_date DESC LIMIT 5");
        console.log('Last 5 Price Progress:', p.rows);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
q();
