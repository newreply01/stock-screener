const { pool } = require('./server/db');

async function check() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT count(*) 
            FROM daily_prices 
            WHERE trade_date = '2025-12-30' AND LENGTH(symbol) > 4
        `);
        console.log('6-digit symbols on 2025-12-30:', res.rows[0].count);

        const res2 = await client.query(`
            SELECT count(*) 
            FROM daily_prices 
            WHERE trade_date = '2025-12-30' AND LENGTH(symbol) = 4
        `);
        console.log('4-digit symbols on 2025-12-30:', res2.rows[0].count);

    } catch (e) {
        console.error(e.message);
    } finally {
        client.release();
        process.exit(0);
    }
}

check();
