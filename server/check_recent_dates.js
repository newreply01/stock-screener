const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { query } = require('./db');

async function check() {
  try {
    const res = await query(`
      SELECT trade_date, COUNT(*) 
      FROM daily_prices 
      WHERE trade_date >= '2026-03-08'
      GROUP BY trade_date 
      ORDER BY trade_date DESC
    `);
    console.log('---DATE_CHECK---');
    res.rows.forEach(r => {
      console.log(`Date: ${r.trade_date.toISOString().split('T')[0]}, Count: ${r.count}`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

check();
