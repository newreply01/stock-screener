const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { query } = require('./db');

async function checkSync() {
  try {
    console.log('--- 檢查同步進度 (fm_sync_progress) ---');
    // 先查欄位名稱
    const cols = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'fm_sync_progress'");
    console.log('Columns:', cols.rows.map(c => c.column_name).join(', '));

    const syncRes = await query("SELECT * FROM fm_sync_progress");
    syncRes.rows.forEach(r => {
      // 假設欄位名稱可能是 dataset 而非 table_name
      const name = r.table_name || r.dataset || r.id || 'unknown';
      const lastDate = r.last_sync_date || r.last_date || 'N/A';
      console.log(`${String(name).padEnd(25)} | Last Sync: ${lastDate} | Success: ${r.last_success}`);
    });

    console.log('\n--- 檢查 daily_prices 3/10 數據 ---');
    const priceRes = await query("SELECT COUNT(*) FROM daily_prices WHERE trade_date = '2026-03-10'");
    console.log(`2026-03-10 股價筆數: ${priceRes.rows[0].count}`);

    const latest = await query("SELECT MAX(trade_date) as max_date FROM daily_prices");
    console.log(`資料庫最新日期: ${latest.rows[0].max_date}`);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

checkSync();
