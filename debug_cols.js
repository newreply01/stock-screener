const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5432 });
async function run() {
    try {
        const res = await pool.query("SELECT * FROM daily_prices LIMIT 1");
        console.log('Columns:', Object.keys(res.rows[0]));
    } catch (err) { console.error(err); } finally { await pool.end(); }
}
run();
