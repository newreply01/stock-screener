const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5533 });

async function check() {
  try {
    const res = await pool.query("SELECT COUNT(*) FROM fundamentals");
    console.log("Local fundamentals total records:", res.rows[0].count);
    const dateRes = await pool.query("SELECT MIN(trade_date) as min_date, MAX(trade_date) as max_date FROM fundamentals");
    console.log(`Local fundamentals range: ${dateRes.rows[0].min_date.toLocaleDateString('en-CA')} to ${dateRes.rows[0].max_date.toLocaleDateString('en-CA')}`);
  } catch (e) {
    console.log('Error:', e.message);
  }
  await pool.end();
}
check();
