const { Pool } = require('pg');

const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5533 });

async function check() {
  try {
    const res = await pool.query("SELECT * FROM system_status LIMIT 1");
    if (res.rows.length > 0) {
      console.log('--- system_status Column Names ---');
      console.log(Object.keys(res.rows[0]).join(', '));
    } else {
      console.log('No data found in system_status');
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
  await pool.end();
}
check();
