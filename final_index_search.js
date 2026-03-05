const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres:postgres123@localhost:5432/stock_screener'
});

async function findIndex() {
    try {
        console.log('--- 1. Any symbol with price > 1000 in ANY table ---');
        const q1 = await pool.query("SELECT symbol, close_price, trade_date FROM daily_prices WHERE close_price > 1000 ORDER BY trade_date DESC LIMIT 5");
        console.table(q1.rows);

        const q2 = await pool.query("SELECT stock_id, close, date FROM fm_stock_price WHERE close > 1000 ORDER BY date DESC LIMIT 5");
        console.table(q2.rows);

        console.log('\n--- 2. Checking specifically for IX0001, TSE, TAIEX in daily_prices ---');
        const q3 = await pool.query("SELECT symbol, count(*) FROM daily_prices WHERE symbol IN ('IX0001', 'TSE', 'TAIEX', 'TWII', '0000', 'Y9999') GROUP BY symbol");
        console.table(q3.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
findIndex();
