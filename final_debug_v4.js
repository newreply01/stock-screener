const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres:postgres123@localhost:5432/stock_screener'
});

async function run() {
    try {
        console.log('--- 1. Search for any index-like high prices ---');
        const s1 = await pool.query("SELECT symbol, close_price, trade_date FROM daily_prices WHERE close_price > 10000 ORDER BY trade_date DESC LIMIT 5");
        console.table(s1.rows);

        console.log('\n--- 2. All unique names in fm_total_margin ---');
        const s2 = await pool.query("SELECT name, count(*), MAX(date) FROM fm_total_margin GROUP BY name");
        console.table(s2.rows);

        console.log('\n--- 3. Check data for 2025-12-22 (from user screenshot) ---');
        const s3 = await pool.query(`
            SELECT m.name, m.margin_purchase_today_balance as p_bal, p.symbol, p.close_price
            FROM fm_total_margin m
            LEFT JOIN daily_prices p ON m.date = p.trade_date
            WHERE m.date >= '2025-12-22' AND m.date < '2025-12-23'
        `);
        console.table(s3.rows);

        console.log('\n--- 4. Check if MarginShortMoney exists for 2025-12-22 ---');
        const s4 = await pool.query("SELECT * FROM fm_total_margin WHERE date >= '2025-12-22' AND date < '2025-12-23' AND name = 'MarginShortMoney'");
        console.table(s4.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
