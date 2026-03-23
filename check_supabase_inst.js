const { Pool } = require('pg');
require('dotenv').config({ path: '/home/xg/stock-screener/.env' });

async function check() {
  const connectionString = process.env.SUPABASE_URL;
  const pool = new Pool({ connectionString });
  try {
    const res = await pool.query(`
      SELECT trade_date, COUNT(*) 
      FROM institutional 
      GROUP BY trade_date 
      ORDER BY trade_date DESC 
      LIMIT 10
    `);
    console.log('--- Supabase institutional Table Dates ---');
    res.rows.forEach(r => {
      console.log(`${r.trade_date.toLocaleDateString('en-CA')}: ${r.count} records`);
    });
  } catch (e) {
    console.log('Error:', e.message);
  }
  await pool.end();
}
check();
