const { pool } = require('./server/db');

async function checkTicks() {
    try {
        const res = await pool.query(`SELECT trade_time, price, previous_close FROM realtime_ticks WHERE symbol='2330' ORDER BY trade_time DESC LIMIT 3;`);
        console.log("=== Latest 2330 Ticks ===");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
checkTicks();
