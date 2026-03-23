const { Pool } = require('pg');
require('dotenv').config({ path: '/home/xg/stock-screener/.env' });

async function check() {
  const pool = new Pool({ connectionString: process.env.SUPABASE_URL });
  try {
    const res = await pool.query("SELECT * FROM stock_health_scores WHERE symbol = '2330' AND calc_date = '2026-03-23'");
    console.log('--- Supabase 2330 Health Details (3/23) ---');
    console.log(JSON.stringify(res.rows[0], null, 2));
  } catch (e) {
    console.log('Error:', e.message);
  }
  await pool.end();
}
check();
