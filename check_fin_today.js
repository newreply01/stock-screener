const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5533 });

async function check() {
  try {
    const res = await pool.query("SELECT COUNT(*) FROM fundamentals WHERE trade_date = '2026-03-23'");
    console.log("Today's fundamentals records count:", res.rows[0].count);
    const instRes = await pool.query("SELECT COUNT(*) FROM institutional WHERE trade_date = '2026-03-23'");
    console.log("Today's institutional records count:", instRes.rows[0].count);
  } catch (e) {
    console.log('Error:', e.message);
  }
  await pool.end();
}
check();
