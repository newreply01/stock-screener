const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5432 });
async function run() {
    try {
        const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_name IN ('daily_prices', 'stock_prices')");
        console.table(res.rows);
        for (const table of ['daily_prices', 'stock_prices']) {
            console.log(`--- ${table} ---`);
            const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = '${table}' ORDER BY ordinal_position`);
            console.table(cols.rows);
        }
    } catch (err) { console.error(err); } finally { await pool.end(); }
}
run();
