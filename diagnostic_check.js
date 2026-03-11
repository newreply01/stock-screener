const { query } = require('./server/db');

async function check() {
    try {
        const symbol = '2330';
        console.log(`Checking data for ${symbol}...`);
        
        const snRes = await query('SELECT * FROM snapshot_last_close WHERE symbol = $1', [symbol]);
        console.log('\n--- snapshot_last_close ---');
        console.table(snRes.rows);
        
        const dpRes = await query('SELECT symbol, close_price, trade_date FROM daily_prices WHERE symbol = $1 ORDER BY trade_date DESC LIMIT 5', [symbol]);
        console.log('\n--- daily_prices (latest) ---');
        console.table(dpRes.rows);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
