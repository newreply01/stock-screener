const { generateAIReport } = require('../utils/ai_service');
const { pool } = require('../db');
require('dotenv').config();

// 並行數量 = API 金鑰數量（最多 5）
const apiKeyCount = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '')
    .split(',').map(k => k.trim()).filter(k => k.length > 20).length;
const CONCURRENCY = Math.min(Math.max(apiKeyCount, 1), 5);

async function processBatch(symbols, startIdx, total, stats) {
    const results = await Promise.allSettled(
        symbols.map(async (symbol) => {
            try {
                const result = await generateAIReport(symbol);
                if (result.success) {
                    stats.success++;
                    process.stdout.write(`✅ ${symbol} `);
                } else {
                    stats.fail++;
                    process.stdout.write(`❌ ${symbol}(${result.error?.substring(0,20)}) `);
                }
            } catch (err) {
                stats.fail++;
                process.stdout.write(`❌ ${symbol}(${err.message?.substring(0,20)}) `);
            }
        })
    );
    console.log(`\n--- 進度: ${startIdx + symbols.length}/${total} | 成功: ${stats.success} | 失敗: ${stats.fail} ---`);
}

async function batchGenerate() {
    console.log('🚀 [Parallel Batch] 開始並行 AI 報告生成...');
    console.log(`⚡ 並行數量: ${CONCURRENCY}（基於 ${apiKeyCount} 組 API 金鑰）`);
    
    try {
        const stocksRes = await pool.query(`
            SELECT DISTINCT symbol 
            FROM stock_health_scores 
            ORDER BY symbol ASC
        `);
        
        const symbols = stocksRes.rows.map(r => r.symbol);
        console.log(`📊 共 ${symbols.length} 檔股票待處理\n`);

        const stats = { success: 0, fail: 0 };
        const startTime = Date.now();

        // 分批並行處理
        for (let i = 0; i < symbols.length; i += CONCURRENCY) {
            const batch = symbols.slice(i, i + CONCURRENCY);
            await processBatch(batch, i, symbols.length, stats);
        }

        const elapsed = Math.round((Date.now() - startTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;

        console.log('\n✨ 批次生成完成:');
        console.log(`   ✅ 成功: ${stats.success}`);
        console.log(`   ❌ 失敗: ${stats.fail}`);
        console.log(`   📊 總計: ${symbols.length}`);
        console.log(`   ⏱️  耗時: ${mins}分${secs}秒`);

    } catch (err) {
        console.error('CRITICAL ERROR during batch process:', err);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

batchGenerate();
