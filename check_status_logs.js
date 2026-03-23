const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5533 });

async function check() {
  try {
    const res = await pool.query("SELECT * FROM script_status ORDER BY updated_at DESC LIMIT 20");
    console.log('--- Script Status Logs ---');
    res.rows.forEach(r => {
      console.log(`[${r.updated_at.toISOString()}] ${r.script_name}: ${r.status} - ${r.message}`);
    });
  } catch (e) {
    console.log('Error or table not found:', e.message);
  }
  await pool.end();
}
check();
