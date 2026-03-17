const { pool } = require('./server/db');
async function run() {
    const q = "SELECT COUNT(*) FROM stocks WHERE industry IS NOT NULL AND industry NOT LIKE '%權證%' AND industry NOT LIKE '%牛證%' AND industry NOT LIKE '%熊證%'";
    const res = await pool.query(q);
    console.log('Filtered Symbol Count:', res.rows[0].count);
    pool.end();
}
run();
