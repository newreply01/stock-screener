const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres:postgres123@localhost:5432/stock_screener'
});

async function debug() {
    try {
        console.log('=== 1. Check fm_total_margin for all available metrics ===');
        const metrics = await pool.query('SELECT name, count(*), MAX(date) as latest FROM fm_total_margin GROUP BY name');
        console.table(metrics.rows);

        console.log('\n=== 2. Check for potential Market Index symbols in daily_prices ===');
        // Check for names containing '加權' or common index codes
        const symbols = await pool.query(`
            SELECT p.symbol, s.name, count(*) 
            FROM daily_prices p 
            LEFT JOIN stocks s ON p.symbol = s.symbol 
            WHERE p.symbol ~ '^IX' OR p.symbol ~ '^000' OR s.name LIKE '%加權%' OR p.symbol = 'TSE' OR p.symbol = 'TAIEX'
            GROUP BY p.symbol, s.name 
            ORDER BY count(*) DESC
            LIMIT 20
        `);
        console.table(symbols.rows);

        console.log('\n=== 3. Sample check for MarginShortMoney values ===');
        const shortSample = await pool.query("SELECT date, margin_purchase_today_balance FROM fm_total_margin WHERE name = 'MarginShortMoney' AND margin_purchase_today_balance > 0 LIMIT 5");
        console.table(shortSample.rows);

        console.log('\n=== 4. Check if MarginShortCash exists (alternative name) ===');
        const altShort = await pool.query("SELECT date, margin_purchase_today_balance FROM fm_total_margin WHERE name LIKE '%Short%' LIMIT 5");
        console.table(altShort.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
debug();
