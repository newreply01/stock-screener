const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5432 });
async function run() {
    try {
        const res = await pool.query(`
            SELECT a.attname as column_name,
                   pg_catalog.format_type(a.atttypid, a.atttypmod) as data_type
            FROM pg_catalog.pg_attribute a
            WHERE a.attrelid = 'public.daily_prices'::regclass
              AND a.attnum > 0
              AND NOT a.attisdropped
        `);
        console.table(res.rows);
    } catch (err) { console.error(err); } finally { await pool.end(); }
}
run();
