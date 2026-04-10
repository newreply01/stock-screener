const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool } = require('../server/db');

async function research() {
    console.log("--- [Research] 深入分析 4/9 與 4/10 的報告雜訊 ---");
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT symbol, report_date, content 
            FROM ai_reports 
            WHERE report_date >= '2026-04-08'
            ORDER BY report_date DESC, symbol ASC
            LIMIT 50
        `);
        
        console.log(`取得 ${res.rowCount} 份近期報告進行分析...\n`);

        const findings = {
            metaTalk: 0,
            instructionRef: 0,
            doubleTitle: 0,
            clean: 0
        };

        res.rows.forEach(row => {
            const first500 = row.content.substring(0, 500).toLowerCase();
            let isDirty = false;

            if (first500.includes('is mentioned in instructions') || first500.includes('follow the template')) {
                findings.instructionRef++;
                isDirty = true;
                console.log(`[DIRTY: Instruction Ref] ${row.symbol} (${row.report_date.toLocaleDateString()})`);
                console.log(`   Snippet: "${row.content.substring(0, 150).replace(/\n/g, ' ')}..."\n`);
            } else if (first500.includes('professional taiwan stock') && first500.indexOf('#') > first500.indexOf('professional')) {
                findings.metaTalk++;
                isDirty = true;
                console.log(`[DIRTY: Meta Talk] ${row.symbol} (${row.report_date.toLocaleDateString()})`);
            } else {
                findings.clean++;
            }
        });

        console.log("\n--- 分析統計 ---");
        console.log(JSON.stringify(findings, null, 2));

    } catch (err) {
        console.error("Research Error:", err);
    } finally {
        client.release();
        process.exit(0);
    }
}
research();
