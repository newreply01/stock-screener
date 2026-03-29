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

async function check() {
    try {
        const today = '2026-03-24';
        console.log(`--- Data Check for ${today} ---`);
        
        const priceRes = await localPool.query('SELECT count(*) FROM daily_prices WHERE trade_date = $1', [today]);
        console.log(`Today Prices Count: ${priceRes.rows[0].count}`);

        const healthRes = await localPool.query('SELECT count(*) FROM stock_health_scores WHERE calc_date = $1', [today]);
        console.log(`Today Health Scores Count: ${healthRes.rows[0].count}`);

        const aiRes = await localPool.query('SELECT count(*) FROM ai_reports WHERE DATE(created_at) = $1', [today]);
        console.log(`Today AI Reports Count: ${aiRes.rows[0].count}`);

        process.exit(0);
    } catch (err) {
        console.error('Check failed:', err);
        process.exit(1);
    }
}

check();
