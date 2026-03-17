const { Pool } = require('pg');
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'stock_screener',
    password: 'postgres123',
    port: 5432,
});

async function check() {
    try {
        const res = await pool.query('SELECT symbol, trade_date, pe_ratio FROM fundamentals ORDER BY trade_date DESC LIMIT 10');
        console.log('--- Latest Fundamentals Data ---');
        console.table(res.rows);
        
        const countRes = await pool.query('SELECT COUNT(*) FROM fundamentals');
        console.log('Total records in fundamentals:', countRes.rows[0].count);
        
        const dateRes = await pool.query('SELECT MIN(trade_date), MAX(trade_date) FROM fundamentals');
        console.log('Date range:', dateRes.rows[0]);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

check();
