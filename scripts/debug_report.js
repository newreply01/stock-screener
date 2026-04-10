const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool } = require('../server/db');

async function debug() {
    const symbol = '1802';
    const date = '2026-04-09';
    const res = await pool.query("SELECT content FROM ai_reports WHERE symbol = $1 AND report_date = $2", [symbol, date]);
    if (res.rows.length > 0) {
        console.log("--- RAW CONTENT START ---");
        console.log(res.rows[0].content);
        console.log("--- RAW CONTENT END ---");
    } else {
        console.log("Report not found for " + symbol + " on " + date);
    }
    process.exit(0);
}
debug();
