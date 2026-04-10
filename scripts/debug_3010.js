const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool } = require('../server/db');

async function debug() {
    const symbol = '3010';
    const date = '2026-04-09';
    const res = await pool.query("SELECT content FROM ai_reports WHERE symbol = $1 AND report_date = $2", [symbol, date]);
    if (res.rows.length > 0) {
        const content = res.rows[0].content;
        console.log("--- RAW CONTENT START (3010) ---");
        console.log(content.substring(0, 500));
        
        const realTitleRegex = /#\s+[\u4e00-\u9fa5\w\s]+\(\d{4,6}\)\s+深度投資分析報告/g;
        const matches = [...content.matchAll(realTitleRegex)];
        console.log("Matches: " + matches.length);
        if (matches.length > 0) {
            console.log("Match 0: " + matches[0][0] + " at " + matches[0].index);
        }
    } else {
        console.log("Not found");
    }
    process.exit(0);
}
debug();
