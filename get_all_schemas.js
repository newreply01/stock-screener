const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5533 });
async function check() {
  const tables = ['daily_prices', 'fm_day_trading', 'fm_institutional', 'fm_margin_trading', 'fm_total_institutional', 'fm_total_margin'];
  for (const t of tables) {
    try {
      const res = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = '${t}' AND table_schema = 'public'`);
      console.log(`${t}: ${res.rows.map(r => r.column_name).join(',')}`);
    } catch(e) { console.log(`${t}: ${e.message}`); }
  }
  await pool.end();
}
check();
