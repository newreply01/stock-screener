const { query } = require('./server/db');

async function check() {
    try {
        const instRes = await query('SELECT trade_date, count(*) FROM institutional GROUP BY trade_date ORDER BY trade_date DESC LIMIT 5');
        console.log('Institutional counts:');
        console.log(instRes.rows);

        const priceRes = await query('SELECT trade_date, count(*) FROM daily_prices WHERE symbol ~ \'^[0-9]{4}$\' GROUP BY trade_date ORDER BY trade_date DESC LIMIT 5');
        console.log('Price counts (stocks):');
        console.log(priceRes.rows);
    } catch (e) {
        console.error(e);
    }
}

check();
