const { Pool } = require('pg');
require('dotenv').config({ path: '/home/xg/stock-screener/.env' });

const localPool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5533 });
const remotePool = new Pool({ connectionString: process.env.SUPABASE_URL });

async function syncTableInRange(tableName, dateCol, startDate, endDate) {
  console.log(`\n📦 Syncing ${tableName} from ${startDate} to ${endDate}...`);
  try {
    const localRes = await localPool.query(`SELECT * FROM ${tableName} WHERE ${dateCol} >= $1 AND ${dateCol} <= $2`, [startDate, endDate]);
    if (localRes.rows.length === 0) {
      console.log(`⚠️ No data found.`);
      return;
    }
    console.log(`✅ Found ${localRes.rows.length} records locally.`);

    const columns = Object.keys(localRes.rows[0]);
    const conflictCols = tableName === 'fundamentals' ? 'symbol, trade_date' : (tableName === 'institutional' ? 'symbol, trade_date' : '');
    
    if (!conflictCols) {
        console.error(`❌ Conflict columns not defined for ${tableName}`);
        return;
    }

    const batchSize = 250;
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
      if (i % 2500 === 0) process.stdout.write(`[${Math.floor(i / localRes.rows.length * 100)}%]`);
      else if (i % 500 === 0) process.stdout.write('.');
    }
    console.log(`\n✅ ${tableName} synced successfully!`);
  } catch (err) {
    console.error(`\n❌ Error syncing ${tableName}:`, err.message);
  }
}

async function main() {
  const startDate = '2025-03-23';
  const endDate = '2026-03-24';
  
  // 1. Sync Fundamentals
  await syncTableInRange('fundamentals', 'trade_date', startDate, endDate);
  
  // 2. Sync Institutional (may be large, sync in chunks if needed or just go)
  await syncTableInRange('institutional', 'trade_date', startDate, endDate);
  
  await localPool.end();
  await remotePool.end();
  process.exit(0);
}

main();
