const { query } = require('./server/db');

async function check() {
    try {
        const res = await query(`
            SELECT symbol, trade_date, close_price 
            FROM daily_prices 
            WHERE symbol = 'TAIEX' 
            ORDER BY trade_date DESC 
            LIMIT 10
        `);
        console.log('TAIEX Data:');
        console.log(res.rows);
    } catch (e) {
        console.error(e);
    }
}

check();
