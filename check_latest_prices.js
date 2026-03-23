const { Pool } = require('pg');

const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5533 });

async function check() {
  try {
    const res = await pool.query("SELECT symbol, trade_date, close_price, change_percent FROM daily_prices WHERE symbol IN ('2330', '2412') ORDER BY trade_date DESC LIMIT 4");
    console.log('--- Latest Prices from daily_prices ---');
    res.rows.forEach(r => {
      console.log(`${r.symbol} (${r.trade_date.toLocaleDateString('en-CA')}): ${r.close_price} (${r.change_percent}%)`);
    });
  } catch (e) {
    console.log('Error:', e.message);
  }
  await pool.end();
}
check();
