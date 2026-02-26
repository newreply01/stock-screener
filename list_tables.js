const { pool } = require('./server/db');
async function list() {
    try {
        const r = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
        console.log('Tables in stock_screener:', r.rows.map(row => row.table_name));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
list();
