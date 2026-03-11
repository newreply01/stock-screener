const { pool } = require('./server/db');

async function main() {
    try {
        const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        const tables = res.rows.map(r => r.table_name);
        console.log(JSON.stringify(tables, null, 2));
    } catch(e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
main();
