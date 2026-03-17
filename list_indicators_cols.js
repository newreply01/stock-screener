const { Pool } = require('pg');
const pool = new Pool({
    user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5432,
});
async function run() {
    try {
        const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'indicators' ORDER BY ordinal_position");
        res.rows.forEach(r => console.log(r.column_name));
    } catch (err) { console.error(err); } finally { await pool.end(); }
}
run();
