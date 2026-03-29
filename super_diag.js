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
        console.log('--- Comprehensive Local Diagnostic ---');
        
        // 1. Check Partitions
        const partRes = await localPool.query(`
            SELECT child.relname AS partition_name
            FROM pg_inherits
            JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
            JOIN pg_class child ON pg_inherits.inhrelid = child.oid
            WHERE parent.relname='realtime_ticks';
        `);
        console.log('Partitions of realtime_ticks:', partRes.rows.map(r => r.partition_name));

        // 2. Check Count
        const countRes = await localPool.query('SELECT count(*) FROM realtime_ticks');
        console.log('Total Ticks:', countRes.rows[0].count);

        // 3. Check Latest
        const latestRes = await localPool.query(`
            SELECT symbol, trade_time, created_at AT TIME ZONE 'Asia/Taipei' as created_at_tpe
            FROM realtime_ticks 
            ORDER BY created_at DESC LIMIT 3
        `);
        console.log('Latest 3 Ticks:');
        latestRes.rows.forEach(r => console.log(r));

        // 4. Check if today's date exists in any tick
        const todayStr = new Date().toISOString().split('T')[0];
        const todayRes = await localPool.query('SELECT count(*) FROM realtime_ticks WHERE trade_time::date = $1', [todayStr]);
        console.log(`Ticks with today's date (${todayStr}):`, todayRes.rows[0].count);

        process.exit(0);
    } catch (err) {
        console.error('Diag failed:', err);
        process.exit(1);
    }
}

run();
