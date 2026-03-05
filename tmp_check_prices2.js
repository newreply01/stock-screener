const { pool } = require('./server/db');

async function check() {
    try {
        const res = await pool.query(`SELECT trade_date, close_price FROM daily_prices WHERE symbol='2330' ORDER BY trade_date DESC LIMIT 5;`);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
check();
