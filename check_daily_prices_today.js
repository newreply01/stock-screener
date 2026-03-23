const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5533 });

async function check() {
  try {
    const res = await pool.query("SELECT symbol, close_price, change_amount, change_percent FROM daily_prices WHERE trade_date = '2026-03-23' AND change_percent != 0 LIMIT 10");
    console.log('--- Daily Prices Today (2026-03-23) ---');
    res.rows.forEach(r => {
      console.log(`${r.symbol}: Close=${r.close_price}, Change=${r.change_amount}, %=${r.change_percent}`);
    });
    if (res.rows.length === 0) {
      const anyRes = await pool.query("SELECT symbol, close_price, change_amount, change_percent FROM daily_prices WHERE trade_date = '2026-03-23' LIMIT 5");
      console.log('--- Any Rows for Today ---');
      anyRes.rows.forEach(r => {
        console.log(`${r.symbol}: Close=${r.close_price}, Change=${r.change_amount}, %=${r.change_percent}`);
      });
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
  await pool.end();
}
check();
