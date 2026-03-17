const { syncTradingDate } = require('./server/finmind_fetcher');
const { pool } = require('./server/db');

async function run() {
    try {
        await syncTradingDate();
        const res = await pool.query('SELECT MAX(date) FROM trading_dates');
        console.log('--- Verification Result ---');
        console.log('Max date in trading_dates:', res.rows[0].max);
        
        const prog = await pool.query("SELECT * FROM fm_sync_progress WHERE dataset = 'TaiwanStockTradingDate'");
        console.table(prog.rows);
    } catch (err) {
        console.error('Error during verification:', err);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

run();
