const { pool } = require('./server/db');

async function run() {
    console.log('--- REVENUE SAMPLE ---');
    const rev = await pool.query('SELECT * FROM monthly_revenue ORDER BY revenue_year DESC, revenue_month DESC LIMIT 5');
    console.log(JSON.stringify(rev.rows, null, 2));

    console.log('--- DIVIDEND SAMPLE ---');
    const div = await pool.query('SELECT * FROM dividend_policy ORDER BY year DESC LIMIT 5');
    console.log(JSON.stringify(div.rows, null, 2));

    console.log('--- TICK SAMPLE ---');
    const ticks = await pool.query('SELECT * FROM realtime_ticks ORDER BY trade_time DESC LIMIT 5');
    console.log(JSON.stringify(ticks.rows, null, 2));

    console.log('--- RECENT DAILY PRICES ---');
    const dp = await pool.query('SELECT symbol, trade_date, close_price, volume FROM daily_prices ORDER BY trade_date DESC LIMIT 5');
    console.log(JSON.stringify(dp.rows, null, 2));

    process.exit(0);
}

run();
