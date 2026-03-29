const { pool } = require('./server/db');

async function check() {
    try {
        console.log('--- Database Status Check ---');
        const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_URL;
        console.log('Connected to:', dbUrl ? 'Remote (Supabase/URL)' : 'Local');
        
        const latestTicks = await pool.query(`
            SELECT symbol, trade_time, created_at, 
                   NOW() - created_at as latency 
            FROM realtime_ticks 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        
        console.log('\nLatest 5 Ticks in realtime_ticks:');
        latestTicks.rows.forEach(r => {
            console.log(`Symbol: ${r.symbol}, TradeTime: ${r.trade_time}, CreatedAt: ${r.created_at}, Latency: ${JSON.stringify(r.latency)}`);
        });

        const statusRes = await pool.query(`
            SELECT * FROM system_status 
            WHERE service_name = 'realtime_crawler.js' 
            ORDER BY check_time DESC 
            LIMIT 5
        `);
        console.log('\nLatest Crawler Status:');
        statusRes.rows.forEach(s => {
            console.log(`[${s.check_time}] Status: ${s.status}, Message: ${s.message}`);
        });

        process.exit(0);
    } catch (err) {
        console.error('Check failed:', err);
        process.exit(1);
    }
}

check();
