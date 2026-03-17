const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5432 });
async function run() {
    try {
        const res = await pool.query(`
            SELECT nmsp_parent.nspname AS parent_schema,
                   parent.relname AS parent_table,
                   nmsp_child.nspname AS child_schema,
                   child.relname AS child_table
            FROM pg_inherits
                JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
                JOIN pg_class child ON pg_inherits.inhrelid = child.oid
                JOIN pg_namespace nmsp_parent ON nmsp_parent.oid = parent.relnamespace
                JOIN pg_namespace nmsp_child ON nmsp_child.oid = child.relnamespace
            WHERE parent.relname = 'daily_prices'
        `);
        console.table(res.rows);
    } catch (err) { console.error(err); } finally { await pool.end(); }
}
run();
