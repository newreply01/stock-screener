const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5533 });

async function check() {
  const tables = [
    { name: 'daily_prices', dateCol: 'trade_date' },
    { name: 'fm_day_trading', dateCol: 'date' },
    { name: 'fm_institutional', dateCol: 'date' },
    { name: 'fm_margin_trading', dateCol: 'date' },
    { name: 'fm_total_institutional', dateCol: 'date' },
    { name: 'fm_total_margin', dateCol: 'date' }
  ];

  console.log('--- After-market Data Status (Local DB) ---');
  for (const table of tables) {
    try {
      const res = await pool.query(`SELECT MAX(${table.dateCol}) as last_date FROM ${table.name}`);
      const lastDate = res.rows[0].last_date;
      // Use local date style to avoid UTC shift issues
      const dateStr = lastDate ? (typeof lastDate === 'string' ? lastDate : lastDate.toLocaleDateString('en-CA')) : 'None';
      console.log(`${table.name}: ${dateStr}`);
    } catch (e) {
      console.log(`${table.name}: Error - ${e.message}`);
    }
  }
  await pool.end();
}
check();
