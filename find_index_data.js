const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres:postgres123@localhost:5432/stock_screener'
});

async function findIndex() {
    try {
        console.log('--- 1. Check fm_stock_price for index symbols ---');
        const r1 = await pool.query(`
            SELECT stock_id, count(*), MAX(date) 
            FROM fm_stock_price 
            WHERE stock_id IN ('TAIEX', 'TSE', 'IX0001', 'TWII', '0000')
            GROUP BY stock_id
        `);
        console.table(r1.rows);

        console.log('\n--- 2. Check fm_total_return_index latest data ---');
        const r2 = await pool.query("SELECT * FROM fm_total_return_index ORDER BY date DESC LIMIT 5");
        console.table(r2.rows);

        console.log('\n--- 3. Check for any record in daily_prices with price > 10000 ---');
        const r3 = await pool.query("SELECT symbol, close_price, trade_date FROM daily_prices WHERE close_price > 10000 LIMIT 10");
        console.table(r3.rows);

        console.log('\n--- 4. Check stock symbols for "加權" ---');
        const r4 = await pool.query("SELECT symbol, name FROM stocks WHERE name LIKE '%加權%'");
        console.table(r4.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
findIndex();
