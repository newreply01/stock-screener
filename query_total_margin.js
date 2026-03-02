const { pool } = require('./server/db');

async function test() {
    try {
        const res = await pool.query("SELECT * FROM fm_total_margin ORDER BY date DESC LIMIT 5");
        console.log('fm_total_margin:', res.rows);

        const taiexRes = await pool.query("SELECT * FROM fm_total_return_index ORDER BY date DESC LIMIT 5");
        console.log('fm_total_return_index:', taiexRes.rows);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
test();
