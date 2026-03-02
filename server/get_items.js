const { pool } = require('./db');
const fs = require('fs');
async function run() {
  const { rows } = await pool.query("SELECT DISTINCT item FROM fm_financial_statements WHERE type IN ('Balance Sheet', 'Cash Flows') AND item NOT LIKE '%（%'");
  fs.writeFileSync('items.json', JSON.stringify(rows.map(r => r.item), null, 2));
  console.log('Saved to items.json');
  pool.end();
}
run();
