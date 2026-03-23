const { Pool } = require('pg');
require('dotenv').config({ path: '/home/xg/stock-screener/.env' });

const localPool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5533 });
const remotePool = new Pool({ connectionString: process.env.SUPABASE_URL });

async function syncRecentInstitutional() {
  console.log('🚀 Syncing recent institutional data (Last 15 trading days)...');
  try {
    // 1. Get the last 15 dates from local
    const dateRes = await localPool.query("SELECT DISTINCT trade_date FROM institutional ORDER BY trade_date DESC LIMIT 15");
    const targetDates = dateRes.rows.map(r => r.trade_date);
    console.log(`Target dates: ${targetDates.map(d => d.toLocaleDateString('en-CA')).join(', ')}`);

    for (const date of targetDates) {
      const dateStr = date.toLocaleDateString('en-CA');
      console.log(`\n📦 Syncing ${dateStr}...`);
      
      const localRows = await localPool.query("SELECT * FROM institutional WHERE trade_date = $1", [date]);
      if (localRows.rows.length === 0) continue;
      console.log(`✅ Found ${localRows.rows.length} records.`);

      const columns = Object.keys(localRows.rows[0]);
      const batchSize = 100;
      
      for (let i = 0; i < localRows.rows.length; i += batchSize) {
        const batch = localRows.rows.slice(i, i + batchSize);
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
          INSERT INTO institutional (${columns.join(', ')})
          VALUES ${placeholders.join(', ')}
          ON CONFLICT (symbol, trade_date) DO UPDATE SET
          ${columns.filter(c => !['symbol', 'trade_date'].includes(c)).map(c => `${c} = EXCLUDED.${c}`).join(', ')}
        `;

        await remotePool.query(sql, values);
        process.stdout.write('.');
      }
    }
    console.log('\n✨ Institutional sync completed.');
  } catch (err) {
    console.error('❌ Sync failed:', err.message);
  } finally {
    await localPool.end();
    await remotePool.end();
    process.exit(0);
  }
}

syncRecentInstitutional();
