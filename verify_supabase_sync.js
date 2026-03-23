const { Pool } = require('pg');
require('dotenv').config({ path: '/home/xg/stock-screener/.env' });

async function check() {
  const connectionString = process.env.SUPABASE_URL;
  const pool = new Pool({ connectionString });
  const today = '2026-03-23';
  try {
    const pRes = await pool.query("SELECT count(*) FROM daily_prices WHERE trade_date = $1", [today]);
    const iRes = await pool.query("SELECT count(*) FROM fm_total_institutional WHERE date = $1", [today]);
    const mRes = await pool.query("SELECT count(*) FROM fm_total_margin WHERE date = $1", [today]);
    
    console.log('--- Supabase Sync Verification (2026-03-23) ---');
    console.log(`Daily Prices: ${pRes.rows[0].count}`);
    console.log(`Market Institutional: ${iRes.rows[0].count}`);
    console.log(`Market Margin: ${mRes.rows[0].count}`);
  } catch (e) {
    console.log('Error:', e.message);
  }
  await pool.end();
}
check();
