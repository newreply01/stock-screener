const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const localPool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'stock_screener',
  password: process.env.DB_PASSWORD || 'postgres123',
  port: parseInt(process.env.DB_PORT || '5533'),
});

async function view(symbol) {
    try {
        const res = await localPool.query('SELECT content FROM ai_reports WHERE symbol = $1', [symbol]);
        if (res.rows.length > 0) {
            console.log(`--- Report for ${symbol} ---`);
            console.log(res.rows[0].content);
        } else {
            console.log(`No report found for ${symbol}`);
        }
        process.exit(0);
    } catch (err) {
        console.error('View failed:', err);
        process.exit(1);
    }
}

const sym = process.argv[2] || '2330';
view(sym);
