const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool } = require('../server/db');

async function cleanup(targetSymbol = null) {
    console.log(`--- [Maintenance V2] 深度報告清理啟動 ${targetSymbol ? `(針對 ${targetSymbol})` : '(全域掃描)'} ---`);
    const client = await pool.connect();
    try {
        let query = `
            SELECT symbol, report_date, content FROM ai_reports 
            WHERE content NOT LIKE '#### 📝 %' 
               OR content ILIKE '%is mentioned in instructions%'
               OR content ILIKE '%follow the template%'
        `;
        let params = [];
        if (targetSymbol) {
            query = "SELECT symbol, report_date, content FROM ai_reports WHERE symbol = $1 AND report_date = '2026-04-09'";
            params = [targetSymbol];
        }

        const res = await client.query(query, params);
        console.log(`掃描完成: 共有 ${res.rowCount} 份報告可能需要清理...`);

        let cleanedCount = 0;
        for (const row of res.rows) {
            let content = row.content;
            const original = content;

            // 1. 移除隱藏的 <thought> 標籤
            content = content.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();

            // 2. 超強效標題鎖定：由後往前尋找「真」報告標題
            // 必須包含「純數字」代碼才視為真標題，排除 [代號] 等佔位符
            const realTitleRegex = /#\s+[\u4e00-\u9fa5\w\s]+\(\d{4,6}\)\s+深度投資分析報告/g;
            const matches = [...content.matchAll(realTitleRegex)];

            if (matches.length > 0) {
                // 取最後一個匹配項（通常 AI 會先重複一遍指令格式，最後才給出真正的報告）
                const lastMatch = matches[matches.length - 1];
                if (lastMatch.index > 0) { // 只要標題不在最開端，就切除前方內容
                    console.log(`[V3 CLEAN] 鎖定末端真標題，切除 ${row.symbol} 之前 ${lastMatch.index} 字元`);
                    content = content.substring(lastMatch.index).trim();
                }
            } else {
                // 如果沒有 "#" 大標題，則尋找「最後一個」不含英文解釋的模板章節
                const sectionMarkers = [
                    /#### 📝 核心趨勢總結/, /#### 📢 個股摘要/, /#### 🧪 基本面/
                ];
                
                let lastValidIndex = -1;
                for(const marker of sectionMarkers) {
                    const sMatches = [...content.matchAll(new RegExp(marker, 'g'))];
                    if (sMatches.length > 0) {
                        const lastM = sMatches[sMatches.length - 1];
                        // 檢查該章節後面 50 字元內是否包含英文 meta 字眼
                        const checkArea = content.substring(lastM.index, lastM.index + 100);
                        if (!checkArea.includes('is mentioned in instructions') && !checkArea.includes('follow the template')) {
                            if (lastM.index > lastValidIndex) lastValidIndex = lastM.index;
                        }
                    }
                }

                if (lastValidIndex > 0) {
                    console.log(`[V3 CLEAN] 鎖定最後正文區塊，切除 ${row.symbol} 之前 ${lastValidIndex} 字元`);
                    content = content.substring(lastValidIndex).trim();
                }
            }

            // 3. 全域強制移除對話型垃圾文字
            const metaTalkPatterns = [
                /#### 📝 核心趨勢總結 is mentioned in instructions[\s\S]*?(\n(?=#)|$)/gi,
                /I will follow the template provided at the end of the prompt\)\.?/gi,
                /Professional Taiwan Stock Investment Analyst[\s\S]*?(?=#)/gi,
                /Use provided data only[\s\S]*?(?=#)/gi
            ];
            for (const p of metaTalkPatterns) {
                content = content.replace(p, '').trim();
            }

            if (content !== original && content.length > 50) {
                await client.query(
                    "UPDATE ai_reports SET content = $1, updated_at = NOW() WHERE symbol = $2 AND report_date = $3",
                    [content, row.symbol, row.report_date]
                );
                cleanedCount++;
            }
        }
        console.log(`--- 清理完畢: 共修正並儲存了 ${cleanedCount} 份報告內容 ---`);
    } finally {
        client.release();
        if(!targetSymbol) process.exit(0);
    }
}

// 根據命令行參數決定執行範圍
const target = process.argv[2];
cleanup(target);
