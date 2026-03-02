const { pool } = require('./server/db');

async function listAndAudit() {
    const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    const tables = res.rows.map(r => r.table_name);

    const results = {};
    for (const table of tables) {
        try {
            const countRes = await pool.query(`SELECT COUNT(*) FROM ${table}`);
            results[table] = { count: parseInt(countRes.rows[0].count) };
        } catch (e) {
            results[table] = { error: e.message };
        }
    }
    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
}

listAndAudit();
