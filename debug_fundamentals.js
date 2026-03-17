const { Pool } = require('pg');
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'stock_screener',
    password: 'postgres123',
    port: 5432,
});

async function checkFundamentals() {
    try {
        const symbol = '1210';
        const res = await pool.query('SELECT symbol, trade_date, pe_ratio, pb_ratio FROM fundamentals WHERE symbol = $1 ORDER BY trade_date DESC LIMIT 20', [symbol]);
        console.log(`--- Fundamentals for ${symbol} ---`);
        console.table(res.rows);
        
        const countRes = await pool.query('SELECT COUNT(*) FROM fundamentals WHERE symbol = $1', [symbol]);
        console.log(`Total records for ${symbol}: ${countRes.rows[0].count}`);
        
        const allCountRes = await pool.query('SELECT COUNT(*) FROM fundamentals');
        console.log(`Total records in fundamentals table: ${allCountRes.rows[0].count}`);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkFundamentals();
