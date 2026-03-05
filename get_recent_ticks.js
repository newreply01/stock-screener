const { query } = require('./server/db');

async function getRecent() {
    try {
        const res = await query(`
            SELECT symbol, trade_time, price 
            FROM realtime_ticks 
            WHERE trade_time > CURRENT_DATE 
            ORDER BY trade_time DESC 
            LIMIT 20
        `);
        console.log('Recent successful ticks today:');
        res.rows.forEach(r => {
            console.log(`[${r.trade_time.toLocaleString()}] ${r.symbol}: ${r.price}`);
        });
    } catch (e) {
        console.error(e);
    }
}

getRecent();
