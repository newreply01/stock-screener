const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5533 });

async function check() {
  try {
    const res = await pool.query(`
      SELECT 
        COUNT(*) as count, 
        pg_size_pretty(SUM(pg_column_size(t))) as raw_size
      FROM news t 
      WHERE published_at >= CURRENT_DATE - INTERVAL '30 days'
    `);
    console.log('--- News Statistics (Last 30 Days) ---');
    console.log(`Count: ${res.rows[0].count}`);
    console.log(`Estimated Size: ${res.rows[0].raw_size}`);
  } catch (e) {
    console.log('Error:', e.message);
  }
  await pool.end();
}
check();
