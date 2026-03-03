const { pool } = require('./server/db');
async function test() {
    try {
        const res = await pool.query("SELECT symbol, name, count(*) as c FROM stocks WHERE name LIKE '%加權%' OR symbol='TAIEX' OR symbol='IX0001' GROUP BY symbol, name");
        console.table(res.rows);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
test();
