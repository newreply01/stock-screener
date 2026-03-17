const { pool } = require('./server/db');
const fs = require('fs');

async function run() {
    try {
        const res = await pool.query("SELECT * FROM stocks LIMIT 1");
        if (res.rows.length > 0) {
            const cols = Object.keys(res.rows[0]);
            fs.writeFileSync(__dirname + '/stocks_columns.txt', cols.join('\n'));
            console.log('✅ Columns saved');
        } else {
            console.log('No rows in stocks table');
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
run();
