const { Pool } = require('pg');
require('dotenv').config({ path: '/home/xg/stock-screener/.env' });

const localPool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5533 });
const remotePool = new Pool({ connectionString: process.env.SUPABASE_URL });

async function syncTable(tableName, dateCol, days) {
  console.log(`\n📦 Syncing ${tableName} (Last ${days} days)...`);
  try {
    const localRes = await localPool.query(`SELECT * FROM ${tableName} WHERE ${dateCol} >= CURRENT_DATE - INTERVAL '1 day' * $1`, [days]);
    if (localRes.rows.length === 0) return;
    console.log(`✅ Found ${localRes.rows.length} records locally.`);

    const columns = Object.keys(localRes.rows[0]);
    const conflictCols = tableName === 'fm_total_institutional' || tableName === 'fm_total_margin' ? 'date, name' : '';
    
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

      const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${placeholders.join(', ')} 
                   ON CONFLICT (${conflictCols}) DO UPDATE SET 
                   ${columns.filter(c => !conflictCols.includes(c)).map(c => `${c} = EXCLUDED.${c}`).join(', ')}`;
      await remotePool.query(sql, values);
      process.stdout.write(`.`);
    }
  } catch (err) { console.error(`\n❌ Error syncing ${tableName}:`, err.message); }
}

async function main() {
  await syncTable('fm_total_institutional', 'date', 60);
  await syncTable('fm_total_margin', 'date', 60);
  await localPool.end();
  await remotePool.end();
  process.exit(0);
}
main();
