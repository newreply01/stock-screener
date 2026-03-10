const { pool } = require('./server/db');

async function diag() {
    console.log('--- Diagnostic Starting ---');
    try {
        const syncRes = await pool.query('SELECT dataset, last_sync_date FROM fm_sync_progress ORDER BY last_sync_date DESC');
        console.log('\n[fm_sync_progress]:');
        console.table(syncRes.rows);

        const statusRes = await pool.query('SELECT service_name, status, message, check_time FROM system_status ORDER BY check_time DESC LIMIT 5');
        console.log('\n[system_status]:');
        console.table(statusRes.rows);

        const priceRes = await pool.query('SELECT MIN(trade_date) as min_date, MAX(trade_date) as max_date, COUNT(*) as total_rows FROM daily_prices');
        console.log('\n[daily_prices Summary]:');
        console.table(priceRes.rows);

    } catch (err) {
        console.error('Diagnostic Failed:', err.message);
    } finally {
        await pool.end();
    }
}

diag();
