const { Pool } = require('pg');

const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5533 });

async function check() {
  try {
    const res = await pool.query("SELECT * FROM stock_health_scores WHERE symbol = '2330' AND calc_date = '2026-03-23'");
    console.log('--- 2330 Health Score Details (3/23) ---');
    console.log(JSON.stringify(res.rows[0], null, 2));
  } catch (e) {
    console.log('Error:', e.message);
  }
  await pool.end();
}
check();
