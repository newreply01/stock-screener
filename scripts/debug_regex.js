const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool } = require('../server/db');

async function debug() {
    const symbol = '1802';
    const date = '2026-04-09';
    const res = await pool.query("SELECT content FROM ai_reports WHERE symbol = $1 AND report_date = $2", [symbol, date]);
    if (res.rows.length > 0) {
        const content = res.rows[0].content;
        console.log("--- Content Length: " + content.length);
        
        const tests = [
            { name: 'Original', re: /^#\s+[\u4e00-\u9fa5\w\s]+\(\d{4,6}\)\s+深度投資分析報告/gm },
            { name: 'Simple', re: /# .+?\(\d{4,6}\) 深度投資分析報告/g },
            { name: 'Loose', re: /# .*?\(\d{4,6}\)/g },
            { name: 'Just Hash and Code', re: /#.*?\d{4,6}/g }
        ];
        
        tests.forEach(t => {
            const matches = [...content.matchAll(t.re)];
            console.log(`- ${t.name}: ${matches.length} matches`);
            if (matches.length > 0) {
                console.log(`  First match: "${matches[0][0]}" at index ${matches[0].index}`);
                console.log(`  Last match: "${matches[matches.length-1][0]}" at index ${matches[matches.length-1].index}`);
            }
        });

        if (matches.length > 0) {
            const lastMatch = matches[matches.length - 1];
            console.log("Target index: " + lastMatch.index);
            const cleaned = content.substring(lastMatch.index).trim();
            console.log("Cleaned length: " + cleaned.length);
            console.log("Cleaned start: " + cleaned.substring(0, 100));
        } else {
            console.log("NO MATCHES FOUND!");
        }
    }
    process.exit(0);
}
debug();
