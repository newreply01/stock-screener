const { Pool } = require('pg');
require('dotenv').config({ path: '/home/xg/stock-screener/.env' });

const localPool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5533 });
const remotePool = new Pool({ connectionString: process.env.SUPABASE_URL });

async function syncTable(tableName, dateCol, date) {
  console.log(`\n📦 Syncing ${tableName} for ${date}...`);
  try {
    // 1. Fetch from local
    const localRes = await localPool.query(`SELECT * FROM ${tableName} WHERE ${dateCol}::date = $1`, [date]);
    if (localRes.rows.length === 0) {
      console.log(`⚠️ No local data found for ${tableName} on ${date}.`);
      return;
    }
    console.log(`✅ Found ${localRes.rows.length} records locally.`);

    // 2. Prepare for batch insert to remote
    const columns = Object.keys(localRes.rows[0]);
    const conflictCols = tableName === 'daily_prices' ? 'symbol, trade_date' : (tableName === 'fm_total_institutional' || tableName === 'fm_total_margin' ? 'date, name' : '');
    
    if (!conflictCols) {
        console.error(`❌ Conflict columns not defined for ${tableName}`);
        return;
    }

    const batchSize = 100;
    for (let i = 0; i < localRes.rows.length; i += batchSize) {
      const batch = localRes.rows.slice(i, i + batchSize);
      const values = [];
      const placeholders = [];
      
      batch.forEach((row, rowIndex) => {
        const rowPlaceholders = [];
        columns.forEach(col => {
          values.push(row[col]);
          rowPlaceholders.push(`$${values.length}`);
        });
        placeholders.push(`(${rowPlaceholders.join(', ')})`);
      });

      const sql = `
        INSERT INTO ${tableName} (${columns.join(', ')})
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (${conflictCols}) DO UPDATE SET
        ${columns.filter(c => !conflictCols.includes(c)).map(c => `${c} = EXCLUDED.${c}`).join(', ')}
      `;

      await remotePool.query(sql, values);
      process.stdout.write(`.`);
    }
    console.log(`\n✅ ${tableName} synced successfully!`);
  } catch (err) {
    console.error(`\n❌ Error syncing ${tableName}:`, err.message);
  }
}

async function main() {
  const today = '2026-03-23';
  
  // 0. Sync Stocks table first (to prevent FK errors)
  console.log(`\n📦 Syncing stocks table...`);
  const stocksRes = await localPool.query(`SELECT * FROM stocks`);
  const stockCols = Object.keys(stocksRes.rows[0]);
  const stockBatchSize = 100;
  for (let i = 0; i < stocksRes.rows.length; i += stockBatchSize) {
    const batch = stocksRes.rows.slice(i, i + stockBatchSize);
    const values = [];
    const placeholders = [];
    batch.forEach((row, rowIndex) => {
      const rowPlaceholders = [];
      stockCols.forEach(col => {
        values.push(row[col]);
        rowPlaceholders.push(`$${values.length}`);
      });
      placeholders.push(`(${rowPlaceholders.join(', ')})`);
    });
    const sql = `INSERT INTO stocks (${stockCols.join(', ')}) VALUES ${placeholders.join(', ')} 
                 ON CONFLICT (symbol) DO UPDATE SET 
                 ${stockCols.filter(c => c !== 'symbol').map(c => `${c} = EXCLUDED.${c}`).join(', ')}`;
    await remotePool.query(sql, values);
    process.stdout.write(`.`);
  }
  console.log(`\n✅ Stocks table synced.`);

  // 1. Sync Total Institutional
  await syncTable('fm_total_institutional', 'date', today);
  
  // 2. Sync Total Margin
  await syncTable('fm_total_margin', 'date', today);
  
  // 3. Sync Daily Prices
  await syncTable('daily_prices', 'trade_date', today);

  // 4. Sync Individual Institutional (if any)
  await syncTable('institutional', 'trade_date', today);
  
  await localPool.end();
  await remotePool.end();
  process.exit(0);
}

main();
