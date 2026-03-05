const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:postgres123@localhost:5432/stock_screener' });

async function check() {
    try {
        const res = await pool.query("SELECT symbol, count(*), MAX(trade_date) FROM daily_prices WHERE symbol='TAIEX' GROUP BY symbol");
        console.log('TAIEX Data:', res.rows);

        const res2 = await pool.query("SELECT * FROM daily_prices WHERE symbol='TAIEX' ORDER BY trade_date DESC LIMIT 5");
        console.log('Latest TAIEX Records:', res2.rows);
    } catch (e) {
        console.error(e.message);
    } finally {
        await pool.end();
    }
}
check();
