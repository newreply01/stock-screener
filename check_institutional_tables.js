const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5533 });

async function check() {
  const queries = [
    { name: 'institutional', sql: 'SELECT MAX(trade_date) as max_date FROM institutional' },
    { name: 'fm_institutional', sql: 'SELECT MAX(date) as max_date FROM fm_institutional' }
  ];

  console.log('--- Institutional Data Tables Status ---');
  for (const q of queries) {
    try {
      const res = await pool.query(q.sql);
      const lastDate = res.rows[0].max_date;
      const dateStr = lastDate ? (typeof lastDate === 'string' ? lastDate : lastDate.toLocaleDateString('en-CA')) : 'None';
      console.log(`${q.name}: ${dateStr}`);
    } catch (e) {
      console.log(`${q.name}: Error - ${e.message}`);
    }
  }
  await pool.end();
}
check();
