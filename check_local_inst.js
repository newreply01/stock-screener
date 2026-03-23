const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5533 });

async function check() {
  try {
    const res = await pool.query("SELECT COUNT(*) FROM institutional");
    console.log("Local institutional total records:", res.rows[0].count);
    const dateRes = await pool.query("SELECT MAX(trade_date) FROM institutional");
    console.log("Local institutional last date:", dateRes.rows[0].max);
  } catch (e) {
    console.log('Error:', e.message);
  }
  await pool.end();
}
check();
