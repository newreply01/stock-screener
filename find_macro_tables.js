const { pool } = require('./server/db');
async function run() {
    try {
        const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND (table_name ILIKE '%market%' OR table_name ILIKE '%index%' OR table_name ILIKE '%margin%' OR table_name ILIKE '%status%')");
        console.log('Tables:', res.rows.map(r => r.table_name).join(', '));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
run();
