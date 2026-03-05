const { query } = require('./server/db');

async function check() {
    try {
        const res = await query(`
            SELECT s.symbol, s.name, s.market 
            FROM daily_prices p
            JOIN stocks s ON p.symbol = s.symbol
            WHERE p.trade_date = '2026-03-03' AND s.symbol IN ('2330', '2317', '2454', '8069', '6488')
        `);
        console.log('Sample Stocks for 2026-03-03:');
        console.log(res.rows);

        const countFull = await query(`
            SELECT COUNT(*) 
            FROM daily_prices 
            WHERE trade_date = '2026-03-03' 
              AND symbol ~ '^[0-9]{4}$'
        `);
        console.log('Count of 4-digit symbols for 2026-03-03:', countFull.rows[0].count);

    } catch (e) {
        console.error(e);
    }
}

check();
