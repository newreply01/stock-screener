const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres:postgres123@localhost:5432/stock_screener'
});

async function check() {
    try {
        console.log('--- Checking Index Symbols in daily_prices ---');
        const res = await pool.query(`
            SELECT symbol, count(*), MAX(trade_date) as latest 
            FROM daily_prices 
            WHERE symbol IN ('TAIEX', 'TSE', 'IX0001', 'TWII', '0000', 'Y9999') 
            GROUP BY symbol
        `);
        console.table(res.rows);

        console.log('\n--- Checking fm_stock_price for Index ---');
        const res2 = await pool.query(`
            SELECT stock_id, count(*), MAX(date) as latest 
            FROM fm_stock_price 
            WHERE stock_id IN ('TAIEX', 'TSE', 'IX0001', 'TWII') 
            GROUP BY stock_id
        `);
        console.table(res2.rows);

    } catch (e) {
        console.error(e.message);
    } finally {
        await pool.end();
    }
}
check();
