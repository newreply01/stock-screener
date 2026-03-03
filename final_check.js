const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres:postgres123@localhost:5432/stock_screener'
});

async function run() {
    try {
        console.log('--- 1. Search for items in daily_prices with close > 10000 (potential index) ---');
        const s1 = await pool.query("SELECT symbol, close_price, trade_date FROM daily_prices WHERE close_price > 10000 ORDER BY trade_date DESC LIMIT 10");
        console.table(s1.rows);

        console.log('\n--- 2. Compare MarginPurchaseMoney vs MarginShortMoney on a specific date ---');
        const s2 = await pool.query(`
            SELECT date, name, margin_purchase_today_balance 
            FROM fm_total_margin 
            WHERE date = (SELECT MAX(date) FROM fm_total_margin)
            AND name IN ('MarginPurchaseMoney', 'MarginShortMoney')
        `);
        console.table(s2.rows);

        console.log('\n--- 3. Check if TAIEX data exists for ANY date ---');
        const s3 = await pool.query("SELECT count(*) FROM daily_prices WHERE symbol = 'TAIEX'");
        console.log('TAIEX records:', s3.rows[0].count);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
