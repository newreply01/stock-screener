const { pool } = require('./server/db');
async function run() {
    try {
        const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
        res.rows.forEach(r => console.log(r.table_name));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
run();
