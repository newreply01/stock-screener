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
        console.log('--- Database Table Inventory ---');
        const res = await localPool.query(`
            SELECT 
                c.relname AS table_name,
                pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
                pg_size_pretty(pg_relation_size(c.oid)) AS table_size,
                pg_size_pretty(pg_total_relation_size(c.oid) - pg_relation_size(c.oid)) AS index_size,
                c.reltuples::bigint AS row_estimate
            FROM pg_class c
            LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' 
              AND c.relkind = 'r'
            ORDER BY pg_total_relation_size(c.oid) DESC;
        `);
        console.table(res.rows);
        
        console.log('\n--- realtime_ticks (Slim View Sample) ---');
        const slimRes = await localPool.query(`
            SELECT symbol, trade_time, price, volume 
            FROM realtime_ticks 
            ORDER BY trade_time DESC LIMIT 5
        `);
        console.table(slimRes.rows);

        process.exit(0);
    } catch (err) {
        console.error('Inventory failed:', err);
        process.exit(1);
    }
}

run();
