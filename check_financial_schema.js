const { Pool } = require('pg');

const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5533 });

async function check() {
  try {
    const res = await pool.query("SELECT * FROM fm_financial_statements LIMIT 10");
    if (res.rows.length > 0) {
      console.log('--- fm_financial_statements Sample ---');
      console.log('Columns:', Object.keys(res.rows[0]).join(', '));
      const names = [...new Set(res.rows.map(r => r.type || r.name || r.data_name))];
      console.log('Types/Names sample:', names);
    } else {
      console.log('No data found in fm_financial_statements');
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
  await pool.end();
}
check();
