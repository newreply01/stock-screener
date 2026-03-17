const { Pool } = require('pg');
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'stock_screener',
    password: 'postgres123',
    port: 5432,
});

async function readStatus() {
    try {
        console.log("--- Recent system_status ---");
        const res = await pool.query(`
            SELECT service_name, status, message, check_time 
            FROM system_status 
            ORDER BY check_time DESC 
            LIMIT 30
        `);
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

readStatus();
