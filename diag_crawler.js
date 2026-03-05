const { query } = require('./server/db');

async function diag() {
    console.log('--- System Status (realtime_crawler.js) ---');
    try {
        const res = await query(`
            SELECT check_time, status, message 
            FROM system_status 
            WHERE service_name = 'realtime_crawler.js' 
            ORDER BY check_time DESC 
            LIMIT 10
        `);
        res.rows.forEach(r => {
            console.log(`[${r.check_time.toLocaleString()}] ${r.status}: ${r.message}`);
        });

        console.log('\n--- Recent Realtime Ticks (Last 5 min) ---');
        const ticks = await query(`
            SELECT symbol, trade_time, price 
            FROM realtime_ticks 
            WHERE trade_time > NOW() - INTERVAL '5 minutes'
            ORDER BY trade_time DESC
            LIMIT 5
        `);
        console.log(`Recent ticks count: ${ticks.rowCount}`);
        ticks.rows.forEach(r => {
            console.log(`  ${r.symbol} @ ${r.trade_time}: ${r.price}`);
        });

        console.log('\n--- Stock Count Check ---');
        const stocks = await query("SELECT count(*) FROM stocks WHERE symbol ~ '^[0-9]{4}$'");
        console.log(`Total target stocks: ${stocks.rows[0].count}`);

    } catch (e) {
        console.error(e);
    }
}

diag();
