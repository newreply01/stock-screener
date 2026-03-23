const { Pool } = require('pg');
require('dotenv').config({ path: '/home/xg/stock-screener/.env' });

const localPool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5533 });
const remotePool = new Pool({ connectionString: process.env.SUPABASE_URL });

async function syncFocus() {
  console.log('🚀 Syncing market_focus_daily (with JSON fix)...');
  try {
    const res = await localPool.query("SELECT * FROM market_focus_daily");
    if (res.rows.length === 0) return;
    const columns = Object.keys(res.rows[0]);
    for (const row of res.rows) {
      const vals = columns.map(c => {
        const val = row[c];
        if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
          return JSON.stringify(val);
        }
        return val;
      });
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const sql = `INSERT INTO market_focus_daily (${columns.join(', ')}) VALUES (${placeholders}) 
                   ON CONFLICT (trade_date, market, stock_types) DO UPDATE SET 
                   ${columns.filter(c => !['trade_date', 'market', 'stock_types'].includes(c)).map(c => `${c} = EXCLUDED.${c}`).join(', ')}`;
      await remotePool.query(sql, vals);
      process.stdout.write('.');
    }
    console.log('\n✅ Focus synced.');
  } catch (e) { console.error('Focus sync error:', e.message); }
}

async function syncTAIEX() {
  console.log('🚀 Syncing TAIEX daily_prices...');
  try {
    const res = await localPool.query("SELECT * FROM daily_prices WHERE symbol = 'TAIEX' AND trade_date >= CURRENT_DATE - INTERVAL '100 days'");
    if (res.rows.length === 0) return;
    const columns = Object.keys(res.rows[0]);
    for (const row of res.rows) {
      const vals = columns.map(c => row[c]);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const sql = `INSERT INTO daily_prices (${columns.join(', ')}) VALUES (${placeholders}) 
                   ON CONFLICT (symbol, trade_date) DO UPDATE SET 
                   ${columns.filter(c => !['symbol', 'trade_date'].includes(c)).map(c => `${c} = EXCLUDED.${c}`).join(', ')}`;
      await remotePool.query(sql, vals);
      process.stdout.write('.');
    }
    console.log('\n✅ TAIEX synced.');
  } catch (e) { console.error('TAIEX sync error:', e.message); }
}

async function main() {
  await syncFocus();
  await syncTAIEX();
  await localPool.end();
  await remotePool.end();
  process.exit(0);
}
main();
