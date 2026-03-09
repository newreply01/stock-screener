const { pool } = require('./server/db');
async function list() {
    try {
        const res = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
        console.log("TABLES_START");
        console.log(res.rows.map(r => r.tablename).join('\n'));
        console.log("TABLES_END");
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
        process.exit(0);
    }
}
list();
