const { query } = require('../db');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

async function cleanDatabaseWarrants() {
  console.log('--- 移除資料庫中所有權證資料 ---');
  try {
    // We target symbols that are NOT 4-digit (stocks) AND NOT 6-digit starting with 00 (ETFs)
    const filter = `NOT (symbol ~ '^\\d{4}$' OR symbol ~ '^00\\d{4}$')`;
    
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
    await query(`DELETE FROM fm_stock_news WHERE NOT (stock_id ~ '^\\d{4}$' OR stock_id ~ '^00\\d{4}$')`);
    await query(`DELETE FROM fm_stock_per WHERE NOT (stock_id ~ '^\\d{4}$' OR stock_id ~ '^00\\d{4}$')`);
    
    // fm_margin_trading, fm_shareholding uses 'stock_id' instead of 'symbol'
    await query(`DELETE FROM fm_margin_trading WHERE NOT (stock_id ~ '^\\d{4}$' OR stock_id ~ '^00\\d{4}$')`);
    await query(`DELETE FROM fm_shareholding WHERE NOT (stock_id ~ '^\\d{4}$' OR stock_id ~ '^00\\d{4}$')`);
    // fm_broker_trading uses 'stock_id'
    await query(`DELETE FROM fm_broker_trading WHERE NOT (stock_id ~ '^\\d{4}$' OR stock_id ~ '^00\\d{4}$')`);
    
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
