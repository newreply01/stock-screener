const { Pool } = require('pg');
require('dotenv').config({ path: '/home/xg/stock-screener/.env' });

async function check() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const res = await pool.query("SELECT MAX(date) FROM fm_total_institutional");
    console.log('Supabase fm_total_institutional Max Date:', res.rows[0].max);
  } catch (e) {
    console.log('Error:', e.message);
  }
  await pool.end();
}
check();
