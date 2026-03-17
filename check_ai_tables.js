const { pool } = require('./server/db');
async function check() {
    const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'ai_%'");
    console.log('Tables starting with ai_:');
    res.rows.forEach(r => console.log(' - ' + r.table_name));
    pool.end();
}
check();
