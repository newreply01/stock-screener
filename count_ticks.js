const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5533 });
pool.query('SELECT COUNT(*) FROM realtime_ticks').then(r => {
  console.log('Total Ticks:', r.rows[0].count);
  process.exit(0);
});
