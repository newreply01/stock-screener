const { query } = require('./server/db');

async function check() {
    try {
        const res = await query(`
            SELECT s.market, COUNT(*) 
            FROM daily_prices p
            JOIN stocks s ON p.symbol = s.symbol
            WHERE p.trade_date = '2026-03-03'
            GROUP BY s.market
        `);
        console.log('Market Distribution for 2026-03-03:');
        console.log(res.rows);
    } catch (e) {
        console.error(e);
    }
}

check();
