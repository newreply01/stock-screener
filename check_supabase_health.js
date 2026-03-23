const { Pool } = require('pg');
require('dotenv').config({ path: '/home/xg/stock-screener/.env' });

async function check() {
  const pool = new Pool({ connectionString: process.env.SUPABASE_URL });
  try {
    const res = await pool.query("SELECT COUNT(*), MAX(calc_date) FROM stock_health_scores");
    console.log(`Supabase stock_health_scores count: ${res.rows[0].count}`);
    console.log(`Latest calc_date: ${res.rows[0].max}`);
    
    const sample = await pool.query("SELECT symbol, name, roe, gross_margin FROM stock_health_scores WHERE symbol IN ('2330', '2412') ORDER BY calc_date DESC LIMIT 2");
    console.log('\nSample Data for 2330/2412:');
    sample.rows.forEach(r => console.log(JSON.stringify(r)));
  } catch (e) {
    console.log('Error:', e.message);
  }
  await pool.end();
}
check();
