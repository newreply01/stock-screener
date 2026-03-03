const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres:postgres123@localhost:5432/stock_screener'
});

async function run() {
    try {
        console.log('--- 1. Check TAIEX in daily_prices ---');
        const r1 = await pool.query("SELECT * FROM daily_prices WHERE symbol = 'TAIEX' ORDER BY trade_date DESC LIMIT 1");
        console.table(r1.rows);

        console.log('\n--- 2. Check TAIEX in fm_stock_price ---');
        const r2 = await pool.query("SELECT * FROM fm_stock_price WHERE stock_id = 'TAIEX' ORDER BY date DESC LIMIT 1");
        console.table(r2.rows);

        console.log('\n--- 3. Check fm_total_return_index ---');
        const r3 = await pool.query("SELECT * FROM fm_total_return_index ORDER BY date DESC LIMIT 1");
        console.table(r3.rows);

        console.log('\n--- 4. Check MarginShort data on latest date ---');
        const r4 = await pool.query(`
            SELECT date, name, margin_purchase_today_balance 
            FROM fm_total_margin 
            WHERE date = (SELECT MAX(date) FROM fm_total_margin)
            AND name LIKE '%Short%'
        `);
        console.table(r4.rows);

        console.log('\n--- 5. Find ANY symbol with price > 10000 ---');
        const r5 = await pool.query("SELECT symbol, close_price, trade_date FROM daily_prices WHERE close_price > 10000 ORDER BY trade_date DESC LIMIT 5");
        console.table(r5.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
