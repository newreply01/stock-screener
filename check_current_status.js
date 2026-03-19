const { pool } = require('./server/db');
const fs = require('fs');

async function checkStatus() {
    const results = {
        db_alive: false,
        system_status: [],
        sync_progress: [],
        error: null
    };

    try {
        const dbRes = await pool.query('SELECT 1 as is_alive');
        results.db_alive = dbRes.rows[0].is_alive === 1;

        const sysRes = await pool.query(`
            SELECT DISTINCT ON (service_name) service_name, status, message, check_time 
            FROM system_status 
            ORDER BY service_name, check_time DESC
        `);
        results.system_status = sysRes.rows;

        const progressRes = await pool.query(`
            SELECT dataset, last_sync_date 
            FROM fm_sync_progress 
            ORDER BY last_sync_date DESC LIMIT 50
        `);
        results.sync_progress = progressRes.rows;

    } catch (err) {
        results.error = err.message;
    }

    fs.writeFileSync('status_output.json', JSON.stringify(results, null, 2));
    process.exit(0);
}

checkStatus();
