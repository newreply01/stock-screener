const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:postgres123@localhost:5432/stock_screener' });
async function run() {
    try {
        await pool.query("DELETE FROM daily_prices WHERE symbol='TAIEX'");
        console.log('Deleted all TAIEX records.');
    } catch (e) {
        console.error(e.message);
    } finally {
        await pool.end();
        process.exit(0);
    }
}
run();
