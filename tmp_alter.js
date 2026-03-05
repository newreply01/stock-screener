const { pool } = require('./server/db');

async function alterDB() {
    try {
        await pool.query(`ALTER TABLE realtime_ticks ADD COLUMN IF NOT EXISTS previous_close NUMERIC(10,2);`);
        console.log("Column added successfully!");
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
alterDB();
