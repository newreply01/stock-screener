const { pool } = require('./server/db');
async function check() {
    try {
        const res = await pool.query("SELECT dataset, COUNT(*) as count FROM fm_sync_progress GROUP BY dataset ORDER BY count DESC");
        console.log('--- Completed Datasets ---');
        res.rows.forEach(r => {
            console.log(`${r.dataset}: ${r.count}`);
        });
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();
