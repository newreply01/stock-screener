const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5432 });
async function run() {
    try {
        const res = await pool.query("SELECT view_definition FROM information_schema.views WHERE table_name = 'daily_prices'");
        if (res.rows.length > 0) {
            console.log('--- View Definition ---');
            console.log(res.rows[0].view_definition);
        } else {
            console.log('daily_prices is NOT a view.');
        }
    } catch (err) { console.error(err); } finally { await pool.end(); }
}
run();
