const { query } = require('../db');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

async function cleanDatabaseWarrants() {
  console.log('--- 移除資料庫中所有權證資料 ---');
  try {
    // We only keep 4-digit stocks (^\\d{4}$), ETFs starting with 00 (^00\\d{3,4}$), and major indices
    const filter = `NOT (symbol ~ '^(\\d{4}|00\\d{3,4})$' OR symbol IN ('TAIEX', 'TSE', 'OTC'))`;
    
    // Some tables might not have ON DELETE CASCADE, so we delete manually just in case
    console.log('正在清理子資料表...');
    
    await query(`DELETE FROM ai_reports WHERE ${filter}`);
    await query(`DELETE FROM realtime_ticks WHERE ${filter}`);
    await query(`DELETE FROM realtime_ticks_history WHERE ${filter}`);
    await query(`DELETE FROM indicators WHERE ${filter}`);
    await query(`DELETE FROM daily_prices WHERE ${filter}`);
    await query(`DELETE FROM fundamentals WHERE ${filter}`);
    await query(`DELETE FROM institutional WHERE ${filter}`);
    await query(`DELETE FROM monthly_revenue WHERE ${filter}`);
    await query(`DELETE FROM dividend_policy WHERE ${filter}`);
    await query(`DELETE FROM stock_health_scores WHERE ${filter}`);
    await query(`DELETE FROM corp_events WHERE ${filter}`);
    await query(`DELETE FROM financial_statements WHERE ${filter}`);
    
    // Some use 'stock_id'
    const stockIdFilter = `NOT (stock_id ~ '^(\\d{4}|00\\d{3,4})$' OR stock_id IN ('TAIEX', 'TSE', 'OTC'))`;
    await query(`DELETE FROM fm_stock_news WHERE ${stockIdFilter}`);
    await query(`DELETE FROM fm_stock_per WHERE ${stockIdFilter}`);
    
    // fm_margin_trading, fm_shareholding uses 'stock_id' instead of 'symbol'
    await query(`DELETE FROM fm_margin_trading WHERE ${stockIdFilter}`);
    await query(`DELETE FROM fm_shareholding WHERE ${stockIdFilter}`);
    // fm_broker_trading uses 'stock_id'
    await query(`DELETE FROM fm_broker_trading WHERE ${stockIdFilter}`);
    
    console.log('正在清理主資料表 (stocks)...');
    const res = await query(`DELETE FROM stocks WHERE ${filter}`);
    
    console.log(`成功刪除 ${res.rowCount} 筆無效（權證及特別股等）主標的資料及其歷史紀錄。`);
  } catch (err) {
    console.error('刪除權證資料時發生錯誤:', err);
  } finally {
    process.exit(0);
  }
}

cleanDatabaseWarrants();
