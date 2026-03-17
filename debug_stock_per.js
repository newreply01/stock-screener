const { Pool } = require('pg');
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'stock_screener',
    password: 'postgres123',
    port: 5432,
});

async function checkStockPer() {
    try {
        const symbol = '1210';
        const res = await pool.query('SELECT stock_id, date, pe_ratio, pb_ratio FROM fm_stock_per WHERE stock_id = $1 ORDER BY date DESC LIMIT 20', [symbol]);
        console.log(`--- fm_stock_per for ${symbol} ---`);
        console.table(res.rows);
        
        const countRes = await pool.query('SELECT COUNT(*) FROM fm_stock_per WHERE stock_id = $1', [symbol]);
        console.log(`Total records for ${symbol}: ${countRes.rows[0].count}`);
        
        const allCountRes = await pool.query('SELECT COUNT(*) FROM fm_stock_per');
        console.log(`Total records in fm_stock_per table: ${allCountRes.rows[0].count}`);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkStockPer();
