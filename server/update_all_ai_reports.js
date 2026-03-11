const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { query } = require('./db');
const { generateAIReport } = require('./utils/ai_service');

async function updateAllReports() {
  console.log('--- 開始批次更新所有 AI 分析報告 ---');
  
  try {
    const res = await query("SELECT symbol FROM stocks WHERE symbol ~ '^\\d{4}$' OR symbol ~ '^00\\d{4}$' ORDER BY symbol ASC");
    const symbols = res.rows.map(r => r.symbol);
    
    console.log(`找到 ${symbols.length} 檔個股需要更新報告。`);

    const BATCH_SIZE = 5;
    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const batch = symbols.slice(i, i + BATCH_SIZE);
      console.log(`正在處理批次 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(symbols.length / BATCH_SIZE)}: ${batch.join(', ')}`);
      
      const promises = batch.map(async (symbol) => {
        try {
          const result = await generateAIReport(symbol);
          if (result.success) {
            console.log(`  ✅ ${symbol} 更新成功`);
          } else {
            console.error(`  ❌ ${symbol} 更新失敗: ${result.error}`);
          }
        } catch (err) {
          console.error(`  ❌ ${symbol} 發生錯誤: ${err.message}`);
        }
      });
      
      await Promise.all(promises);
      
      if (i + BATCH_SIZE < symbols.length) {
        // No delay for mock generation
      }
    }

    console.log('--- 所有報告更新完成！ ---');
  } catch (err) {
    console.error('批次更新發生嚴重錯誤:', err);
  } finally {
    process.exit(0);
  }
}

updateAllReports();
