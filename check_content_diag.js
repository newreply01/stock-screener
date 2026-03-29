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

async function run() {
    try {
        console.log('--- Checking Latest Ingested Content ---');
        
        const latestRes = await localPool.query(`
            SELECT symbol, trade_time, created_at, 
                   EXTRACT(EPOCH FROM (NOW() - created_at)) as seconds_old
            FROM realtime_ticks 
            ORDER BY created_at DESC LIMIT 30
        `);
        
        console.log(`Found ${latestRes.rows.length} recent records:`);
        latestRes.rows.forEach(r => {
            console.log(`Symbol: ${r.symbol}, TradeTime: ${r.trade_time}, CreatedAt: ${r.created_at}, Age: ${r.seconds_old}s`);
        });

        process.exit(0);
    } catch (err) {
        console.error('Diag failed:', err);
        process.exit(1);
    }
}

run();
