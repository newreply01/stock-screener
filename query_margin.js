const { pool } = require('./server/db');

async function test() {
    try {
        const res = await pool.query('SELECT stock_id, COUNT(*) FROM fm_margin_trading GROUP BY stock_id ORDER BY COUNT(*) DESC LIMIT 5');
        console.log('Margin IDs:', res.rows);

        const taiexRes = await pool.query("SELECT symbol, COUNT(*) FROM daily_prices WHERE symbol LIKE '%TAIEX%' OR symbol = '0000' OR symbol = 't00' GROUP BY symbol");
        console.log('TAIEX Daily:', taiexRes.rows);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
test();
