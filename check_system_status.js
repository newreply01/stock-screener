const { Pool } = require('pg');

const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5533 });

async function check() {
  try {
    const res = await pool.query("SELECT * FROM system_status ORDER BY check_time DESC LIMIT 30");
    console.log('--- System Status Recent Logs ---');
    res.rows.forEach(r => {
      console.log(`[${r.check_time.toLocaleString('zh-TW')}] ${r.service_name} | ${r.status} | ${r.message}`);
    });
  } catch (e) {
    console.log('Error:', e.message);
  }
  await pool.end();
}
check();
