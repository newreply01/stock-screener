const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool } = require('../server/db');

async function verify() {
    console.log("--- [Verify] 正在重新檢查報告內容 ---");
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT symbol, report_date, left(content, 200) as snippet 
            FROM ai_reports 
            WHERE (content ILIKE '%<thought>%'
               OR content ILIKE '%professional taiwan stock%'
               OR content ILIKE '%1. Use provided data%'
               OR content LIKE '####, [!TIP]%')
            LIMIT 20
        `);
        
        if (res.rowCount === 0) {
            console.log("✅ 恭喜！資料庫中已無發現包含明顯提示詞或思考標籤的報告。");
        } else {
            console.log(`⚠️ 發現 ${res.rowCount} 份（可能更多）報告仍包含 Artifacts：`);
            res.rows.forEach(r => {
                console.log(`- ${r.symbol} (${r.report_date.toLocaleDateString()}): "${r.snippet.replace(/\n/g, ' ')}..."`);
            });
        }
    } finally {
        client.release();
        process.exit(0);
    }
}
verify();
