const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool } = require('../server/db');

async function cleanup() {
    console.log("--- [Maintenance] 歷史報告內容清理啟動 ---");
    const client = await pool.connect();
    try {
        // 找出內容不以 '####' 開頭，或者包含 <thought> 標籤，或是包含特定提示詞前綴的報告
        const res = await client.query(`
            SELECT symbol, report_date, content 
            FROM ai_reports 
            WHERE content NOT LIKE '####%' 
               OR content ILIKE '%<thought>%'
               OR content ILIKE '%professional taiwan stock%'
        `);
        console.log(`掃描完成: 共有 ${res.rowCount} 份報告符合清理條件...`);

        let cleanedCount = 0;
        for (const row of res.rows) {
            let content = row.content;
            const original = content;

            // 1. 移除隱藏的 <thought> 標籤及其內容 (Case-insensitive)
            content = content.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();

            // 2. 徹底移除有效報告標題之前的任何文字 (雜訊/提示詞/思考過程)
            // 尋找符合標題格式的起始點：# 標題, ## 章節, #### 章節
            const realHeaderPatterns = [
                /# .*?\(?\d{4,6}?\)?/, // 匹配 "# 股票名稱 (1234)"
                /#### 📝/, /#### 📢/, /#### 🧪/, /#### 📊/, /#### 💡/, // 匹配新版模板關鍵章節
                /#### 1\./, /## 1\./ // 匹配舊版章節
            ];

            let firstValidHeaderIndex = -1;
            for (const p of realHeaderPatterns) {
                const idx = content.search(p);
                if (idx !== -1 && (firstValidHeaderIndex === -1 || idx < firstValidHeaderIndex)) {
                    firstValidHeaderIndex = idx;
                }
            }

            if (firstValidHeaderIndex > 0) {
                // 如果找到合法標題且前面有文字，則直接切除前綴
                content = content.substring(firstValidHeaderIndex).trim();
            }

            // 3. 特殊情況：如果第一個標題本身就是垃圾 (如 ####, [!TIP])
            if (content.startsWith('####, [')) {
                 const nextHeader = content.indexOf('#', 10);
                 if (nextHeader !== -1) content = content.substring(nextHeader).trim();
            }

            // 只有在內容發生實質變化，且長度合理時才更新
            if (content !== original && content.length > 50) {
                await client.query(
                    "UPDATE ai_reports SET content = $1, updated_at = NOW() WHERE symbol = $2 AND report_date = $3",
                    [content, row.symbol, row.report_date]
                );
                cleanedCount++;
            }
        }
        console.log(`--- 清理完畢: 共修正並儲存了 ${cleanedCount} 份報告內容 ---`);
    } catch (err) {
        console.error("[Maintenance Error] 清理過程發生異常:", err);
    } finally {
        client.release();
        process.exit(0);
    }
}

cleanup();
