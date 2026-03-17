const { pool } = require('./server/db');

async function check() {
    try {
        const r = await pool.query('SELECT MAX(date) as max_date FROM trading_dates');
        console.log('FINAL_MAX_DATE:' + r.rows[0].max_date.toISOString());
        
        const r2 = await pool.query("SELECT last_sync_date FROM fm_sync_progress WHERE dataset = 'TaiwanStockTradingDate'");
        console.table(r2.rows);
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

check();
