const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { query } = require('./db');

async function inspect() {
  try {
    const res = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'news'");
    console.log('News Columns:', res.rows.map(c => c.column_name).join(', '));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

inspect();
