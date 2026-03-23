const { Pool } = require('pg');

const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5533 });

async function check() {
  try {
    const res = await pool.query("SELECT MAX(calc_date) FROM stock_health_scores");
    console.log(`Latest calc_date in stock_health_scores: ${res.rows[0].max.toLocaleDateString('en-CA')}`);
    
    const sample = await pool.query("SELECT symbol, name, close_price, calc_date FROM stock_health_scores WHERE symbol = '2330' ORDER BY calc_date DESC LIMIT 1");
    console.log('Sample for 2330:', JSON.stringify(sample.rows[0]));
  } catch (e) {
    console.log('Error:', e.message);
  }
  await pool.end();
}
check();
