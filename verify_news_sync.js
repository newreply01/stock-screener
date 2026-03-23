const { Pool } = require('pg');
require('dotenv').config({ path: '/home/xg/stock-screener/.env' });

async function check() {
  const connectionString = process.env.SUPABASE_URL;
  const pool = new Pool({ connectionString });
  try {
    const res = await pool.query("SELECT count(*) FROM news WHERE publish_at >= CURRENT_DATE - INTERVAL '30 days'");
    console.log(`Supabase news count (Last 30 days): ${res.rows[0].count}`);
  } catch (e) {
    console.log('Error:', e.message);
  }
  await pool.end();
}
check();
