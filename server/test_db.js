const { query, initDatabase } = require('./db');

async function testCounts() {
    await initDatabase();
    const fund = await query('SELECT COUNT(*) FROM fundamentals');
    const inst = await query('SELECT COUNT(*) FROM institutional');
    const prices = await query('SELECT COUNT(*) FROM daily_prices');
    console.log('Fundamentals count:', fund.rows[0].count);
    console.log('Institutional count:', inst.rows[0].count);
    console.log('Daily Prices count:', prices.rows[0].count);

    const sample = await query('SELECT pe_ratio, trade_date FROM fundamentals WHERE symbol = \'2330\' ORDER BY trade_date DESC LIMIT 1');
    console.log('TSMC (2330) latest PE:', sample.rows[0]?.pe_ratio, 'on', sample.rows[0]?.trade_date);

    process.exit(0);
}

testCounts().catch(err => {
    console.error(err);
    process.exit(1);
});
