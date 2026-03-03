const { pool } = require('./server/db');

async function check() {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT count(distinct symbol) as uniq, count(*) as total FROM stocks');
        console.log('Stocks - Unique symbols:', res.rows[0].uniq, 'Total rows:', res.rows[0].total);

        const res2 = await client.query('SELECT symbol, count(*) FROM stocks GROUP BY symbol HAVING count(*) > 1 LIMIT 5');
        console.log('Stock duplicates sample:', res2.rows);

        const res3 = await client.query('SELECT count(*) FROM daily_prices WHERE trade_date = (SELECT MAX(trade_date) FROM daily_prices)');
        console.log('Daily Prices for latest date count:', res3.rows[0].count);

        const res4 = await client.query('SELECT symbol, count(*) FROM daily_prices WHERE trade_date = (SELECT MAX(trade_date) FROM daily_prices) GROUP BY symbol HAVING count(*) > 1 LIMIT 5');
        console.log('Daily Prices duplicates sample:', res4.rows);

    } catch (e) {
        console.error(e.message);
    } finally {
        client.release();
        process.exit(0);
    }
}

check();
