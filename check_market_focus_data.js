const { Pool } = require('pg');

const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5533 });

async function check() {
  try {
    const res = await pool.query("SELECT * FROM market_focus_daily LIMIT 1");
    if (res.rows.length > 0) {
      console.log('--- Market Focus Record Sample ---');
      const row = res.rows[0];
      Object.keys(row).forEach(key => {
        console.log(`${key}: ${typeof row[key] === 'object' ? JSON.stringify(row[key]).substring(0, 100) + '...' : row[key]}`);
      });
    } else {
      console.log('No data found in market_focus_daily');
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
  await pool.end();
}
check();
