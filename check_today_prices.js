const { fetchTWSE, fetchTPEx } = require('./server/fetcher');
const { query } = require('./server/db');

async function checkToday() {
    const today = new Date('2026-03-10');
    console.log('--- Fetching Today (March 10) ---');
    await fetchTWSE(today);
    await fetchTPEx(today);
    
    console.log('--- DB State after fetch ---');
    const res = await query("SELECT symbol, close_price, TO_CHAR(trade_date, 'YYYY-MM-DD') as date_str FROM daily_prices WHERE symbol='2330' AND trade_date >= '2026-03-01' ORDER BY trade_date DESC");
    console.table(res.rows);
    process.exit();
}

checkToday();
