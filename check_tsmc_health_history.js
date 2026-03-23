const { Pool } = require('pg');

const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5533 });

async function check() {
  try {
    const res = await pool.query("SELECT symbol, calc_date, close_price, gross_margin, revenue_growth FROM stock_health_scores WHERE symbol = '2330' ORDER BY calc_date DESC LIMIT 5");
    console.log('--- 2330 Health History ---');
    res.rows.forEach(r => {
      console.log(`${r.symbol} (${r.calc_date.toLocaleDateString('en-CA')}): Price: ${r.close_price}, Margin: ${r.gross_margin}, Growth: ${r.revenue_growth}`);
    });
  } catch (e) {
    console.log('Error:', e.message);
  }
  await pool.end();
}
check();
