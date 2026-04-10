const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool } = require('../server/db');

async function research() {
    console.log("--- [Research] 深入檢查殘留雜訊 ---");
    const client = await pool.connect();
    try {
        const patterns = [
            { name: 'Thought Tags', query: "content ILIKE '%<thought>%'" },
            { name: 'Professional Intro', query: "content ILIKE '%professional taiwan stock%'" },
            { name: 'Instruction List', query: "content ILIKE '%1. Use provided data%'" },
            { name: 'Trend Marker', query: "content ILIKE '%* Trend:%'" },
            { name: 'Formatting Notes', query: "content ILIKE '%template provided%'" }
        ];

        for (const p of patterns) {
            const res = await client.query(`SELECT count(*) FROM ai_reports WHERE ${p.query}`);
            console.log(`- ${p.name}: ${res.rows[0].count} 筆`);
        }

        console.log("\n--- [Samples] 檢查範例內容 ---");
        const samples = await client.query(`
            SELECT symbol, report_date, content 
            FROM ai_reports 
            WHERE content ILIKE '%professional taiwan stock%' 
               OR content ILIKE '%<thought>%' 
               OR content ILIKE '%1. Use provided data%'
            LIMIT 2
        `);
        
        samples.rows.forEach(s => {
            console.log(`\n[${s.symbol} - ${s.report_date.toLocaleDateString()}]`);
            console.log("------------------------------------------");
            console.log(s.content.substring(0, 500) + "...");
        });

    } finally {
        client.release();
        process.exit(0);
    }
}
research();
