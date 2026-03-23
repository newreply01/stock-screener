const { Pool } = require('pg');
require('dotenv').config({ path: '/home/xg/stock-screener/.env' });

async function check() {
  const connectionString = process.env.SUPABASE_URL;
  if (!connectionString) {
    console.error('SUPABASE_URL is not set in .env');
    process.exit(1);
  }
  const pool = new Pool({ connectionString });
  try {
    const res = await pool.query("SELECT MAX(date) FROM fm_total_institutional");
    console.log('Supabase fm_total_institutional Max Date:', res.rows[0].max);
  } catch (e) {
    console.log('Error:', e.message);
  }
  await pool.end();
}
check();
