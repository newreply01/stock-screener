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
        console.log('--- LOCAL Database (5533) Status Check ---');
        
        const latestTicks = await localPool.query(`
            SELECT symbol, trade_time, created_at, 
                   NOW() - created_at as latency 
            FROM realtime_ticks 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        
        console.log('\nLatest 5 Ticks in LOCAL realtime_ticks:');
        latestTicks.rows.forEach(r => {
            console.log(`Symbol: ${r.symbol}, TradeTime: ${r.trade_time}, CreatedAt: ${r.created_at}, Latency: ${JSON.stringify(r.latency)}`);
        });

        const countRes = await localPool.query('SELECT COUNT(*) FROM realtime_ticks');
        console.log(`\nTotal local ticks: ${countRes.rows[0].count}`);

        process.exit(0);
    } catch (err) {
        console.error('Local check failed:', err);
        process.exit(1);
    }
}

check();
