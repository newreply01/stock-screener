const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres:postgres123@localhost:5432/stock_screener'
});

async function run() {
    try {
        console.log('--- 1. Unique names in fm_total_margin ---');
        const s1 = await pool.query("SELECT DISTINCT name FROM fm_total_margin");
        console.table(s1.rows);

        console.log('\n--- 2. High priced symbols in daily_prices ---');
        const s2 = await pool.query("SELECT symbol, MAX(close_price) as max_price FROM daily_prices GROUP BY symbol HAVING MAX(close_price) > 1000 ORDER BY max_price DESC LIMIT 10");
        console.table(s2.rows);

        console.log('\n--- 3. Check data for 2026-03-02 ---');
        const s3 = await pool.query("SELECT * FROM fm_total_margin WHERE date >= '2026-03-01' ORDER BY name");
        console.table(s3.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
