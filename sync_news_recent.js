const { Pool } = require('pg');
require('dotenv').config({ path: '/home/xg/stock-screener/.env' });

const localPool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5533 });
const remotePool = new Pool({ connectionString: process.env.SUPABASE_URL });

async function syncNews() {
  console.log('🚀 Syncing News data (Last 30 days)...');
  try {
    const localRes = await localPool.query("SELECT * FROM news WHERE publish_at >= CURRENT_DATE - INTERVAL '30 days'");
    if (localRes.rows.length === 0) {
      console.log('⚠️ No recent news found locally.');
      return;
    }
    console.log(`✅ Found ${localRes.rows.length} news records.`);

    const columns = Object.keys(localRes.rows[0]);
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
        INSERT INTO news (${columns.join(', ')})
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (news_id) DO UPDATE SET
        ${columns.filter(c => !['id', 'news_id', 'created_at'].includes(c)).map(c => `${c} = EXCLUDED.${c}`).join(', ')}
      `;

      await remotePool.query(sql, values);
      process.stdout.write('.');
    }
    console.log('\n✨ News sync completed.');
  } catch (err) {
    console.error('❌ Sync failed:', err.message);
  } finally {
    await localPool.end();
    await remotePool.end();
    process.exit(0);
  }
}

syncNews();
