const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres:postgres123@localhost:5432/stock_screener'
});

async function run() {
    try {
        console.log('--- 1. Tables in public ---');
        const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log(tables.rows.map(r => r.table_name).join(', '));

        console.log('\n--- 2. Columns in fm_total_margin ---');
        const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'fm_total_margin' ORDER BY ordinal_position");
        console.log(cols.rows.map(r => r.column_name).join(', '));

        console.log('\n--- 3. Check for index data in daily_prices ---');
        const indexCheck = await pool.query(`
            SELECT symbol, count(*) 
            FROM daily_prices 
            WHERE symbol IN ('TAIEX', 'TSE', 'IX0001', '0000', 'Y9999', 'TWII') 
            GROUP BY symbol
        `);
        console.table(indexCheck.rows);

        console.log('\n--- 4. Check for Weighted Index in stocks table (exact name search) ---');
        const weighteds = await pool.query("SELECT symbol, name FROM stocks WHERE name LIKE '%加權%'");
        console.table(weighteds.rows);

        console.log('\n--- 5. Sample row from fm_total_margin for MarginShortMoney ---');
        const shortSample = await pool.query("SELECT * FROM fm_total_margin WHERE name = 'MarginShortMoney' ORDER BY date DESC LIMIT 1");
        console.table(shortSample.rows);

        console.log('\n--- 6. Sample row from fm_total_margin for MarginPurchaseMoney ---');
        const purchaseSample = await pool.query("SELECT * FROM fm_total_margin WHERE name = 'MarginPurchaseMoney' ORDER BY date DESC LIMIT 1");
        console.table(purchaseSample.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
