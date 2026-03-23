const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5533 });

async function check() {
  try {
    const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    console.log('--- Database Tables ---');
    console.log(res.rows.map(r => r.table_name).join(', '));
  } catch (e) {
    console.log('Error:', e.message);
  }
  await pool.end();
}
check();
