const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5432 });
async function run() {
    try {
        const res = await pool.query("SELECT * FROM daily_prices LIMIT 1");
        console.log('EXACT COLUMNS:', JSON.stringify(Object.keys(res.rows[0])));
    } catch (err) {
        console.error('FAILED SELECT *:', err.message);
        // If SELECT * fails, try to describe the table
        const res2 = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'daily_prices'");
        console.log('INFO_SCHEMA COLUMNS:', JSON.stringify(res2.rows.map(r => r.column_name)));
    } finally {
        await pool.end();
    }
}
run();
