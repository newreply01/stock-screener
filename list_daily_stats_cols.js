const { Pool } = require('pg');

const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5533 });

async function check() {
  try {
    const res = await pool.query("SELECT * FROM system_ingestion_daily_stats LIMIT 1");
    if (res.rows.length > 0) {
      console.log('--- system_ingestion_daily_stats Column Names ---');
      console.log(Object.keys(res.rows[0]).join(', '));
    } else {
      console.log('No data found in system_ingestion_daily_stats');
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
  await pool.end();
}
check();
