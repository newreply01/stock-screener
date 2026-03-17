const { pool } = require('./server/db');
async function run() {
    try {
        const t1 = await pool.query("SELECT * FROM fm_margin_trading LIMIT 1");
        const t2 = await pool.query("SELECT * FROM fm_total_return_index LIMIT 1");
        console.log('fm_margin_trading:', Object.keys(t1.rows[0] || {}));
        console.log('fm_total_return_index:', Object.keys(t2.rows[0] || {}));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
run();
