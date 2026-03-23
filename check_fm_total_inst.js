const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5533 });

async function check() {
  try {
    const res = await pool.query("SELECT * FROM fm_total_institutional ORDER BY date DESC LIMIT 10");
    console.log('--- fm_total_institutional Last 10 Rows ---');
    res.rows.forEach(r => {
      console.log(`[${r.date.toLocaleDateString('en-CA')}] ${r.name}: Buy=${r.buy}, Sell=${r.sell}`);
    });
  } catch (e) {
    console.log('Error:', e.message);
  }
  await pool.end();
}
check();
