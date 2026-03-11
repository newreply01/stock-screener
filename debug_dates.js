const { fetchTWSE } = require('./server/fetcher');
const { query } = require('./server/db');

async function debugData() {
    const march9 = new Date('2026-03-09');
    const march10 = new Date('2026-03-10');
    
    console.log('--- Fetching Official TWSE for March 9 ---');
    // We can't easily capture the return of fetchTWSE because it writes directly to DB.
    // So we check the DB BEFORE and AFTER one-by-one or just look at logs/print.
    // Modification: I'll use a custom query to see what's in there.
    
    const check = await query("SELECT symbol, close_price, trade_date FROM daily_prices WHERE symbol='2330' AND trade_date IN ('2026-03-09', '2026-03-10')");
    console.log('Current DB state for 2330:');
    console.table(check.rows);
}

debugData();
