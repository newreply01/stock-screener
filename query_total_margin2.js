const { pool } = require('./server/db');

async function test() {
    try {
        const res = await pool.query("SELECT * FROM fm_total_return_index ORDER BY date DESC LIMIT 5");
        console.log('fm_total_return_index:', res.rows);

        const priceRes = await pool.query("SELECT p.trade_date, p.close_price FROM daily_prices p JOIN stocks s ON p.symbol = s.symbol WHERE p.symbol = 'TAIEX' OR s.name = '加權指數' OR s.name = '發行量加權股價指數' ORDER BY p.trade_date DESC LIMIT 5");
        console.log('TAIEX Daily Prices:', priceRes.rows);

        const marketRes = await pool.query("SELECT * FROM fm_total_margin WHERE name = 'MarginPurchaseMoney' ORDER BY date DESC LIMIT 10");
        console.log('MarginPurchaseMoney:', marketRes.rows.map(r => ({ date: r.date, balance: r.margin_purchase_today_balance })));

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
test();
