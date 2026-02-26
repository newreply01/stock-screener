const { pool } = require('./server/db');
async function checkRecent() {
    try {
        console.log('--- Recent Progress (Last 2 hours) ---');
        const res = await pool.query("SELECT dataset, COUNT(*) as count, MAX(last_sync_date) as latest FROM fm_sync_progress WHERE last_sync_date > NOW() - INTERVAL '2 hours' GROUP BY dataset");
        if (res.rows.length === 0) {
            console.log('No progress records found in the last 2 hours.');
        } else {
            res.rows.forEach(r => {
                console.log(`${r.dataset}: ${r.count} stocks updated, Latest: ${r.latest}`);
            });
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkRecent();
