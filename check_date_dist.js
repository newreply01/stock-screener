const { query } = require('./server/db');

async function check() {
    const res = await Promise.all([
        query('SELECT DISTINCT trade_date FROM daily_prices ORDER BY trade_date DESC LIMIT 10'),
        query('SELECT symbol, MAX(trade_date) FROM daily_prices GROUP BY symbol ORDER BY MAX(trade_date) DESC LIMIT 10'),
        query('SELECT count(*) FROM daily_prices WHERE trade_date = (SELECT MAX(trade_date) FROM daily_prices)')
    ]);

    console.log('--- Top 10 Dates ---');
    console.table(res[0].rows);
    console.log('--- Latest Stocks ---');
    console.table(res[1].rows);
    console.log('--- Count of Records on Max Date ---');
    console.log(res[2].rows[0].count);
    process.exit(0);
}

check().catch(e => {
    console.error(e);
    process.exit(1);
});
