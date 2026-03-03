const { pool } = require('./server/db');
async function test() {
    const res = await pool.query('SELECT symbol, count(*) FROM realtime_ticks GROUP BY symbol ORDER BY count DESC LIMIT 5');
    console.log(res.rows);
    process.exit(0);
}
test();
