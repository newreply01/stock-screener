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
        console.log('--- AI Reports Check ---');
        
        const countRes = await localPool.query('SELECT count(*) FROM ai_reports');
        console.log(`Total AI Reports in Table: ${countRes.rows[0].count}`);

        const latestRes = await localPool.query(`
            SELECT symbol, updated_at 
            FROM ai_reports 
            ORDER BY updated_at DESC LIMIT 10
        `);
        console.log('Latest 10 reports:');
        console.table(latestRes.rows);

        const todayCountRes = await localPool.query(`
            SELECT count(*) 
            FROM ai_reports 
            WHERE updated_at >= CURRENT_DATE
        `);
        console.log(`Reports updated today (since ${new Date().toISOString().split('T')[0]}): ${todayCountRes.rows[0].count}`);

        process.exit(0);
    } catch (err) {
        console.error('Check failed:', err);
        process.exit(1);
    }
}

check();
