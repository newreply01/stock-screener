const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5432 });
async function run() {
    try {
        const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'daily_prices' ORDER BY ordinal_position");
        console.table(res.rows);
    } catch (err) { console.error(err); } finally { await pool.end(); }
}
run();
