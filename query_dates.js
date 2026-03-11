const { pool } = require('./server/db');

async function check() {
    const client = await pool.connect();
    try {
        console.log("Checking latest institutional dates...");
        const res = await client.query("SELECT MAX(trade_date) FROM institutional");
        console.log("Overall MAX(trade_date):", res.rows[0].max);
        
        const res2 = await client.query("SELECT MAX(trade_date) FROM institutional WHERE symbol = '2330'");
        console.log("2330 MAX(trade_date):", res2.rows[0].max);

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}
check();
