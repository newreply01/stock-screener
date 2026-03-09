const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'stock_screener',
    password: 'postgres123',
    port: 5432
});

async function run() {
    try {
        console.log('--- Verifying 12/24 and 12/31 Ingestion ---');
        
        const margin = await pool.query("SELECT date, name, margin_purchase_today_balance, short_sale_today_balance FROM fm_total_margin WHERE date IN ('2025-12-24', '2025-12-31') ORDER BY date, name");
        console.log('\nMARGIN ROWS:');
        console.table(margin.rows.map(r => ({
            date: r.date.toISOString().split('T')[0],
            name: r.name,
            margin: r.margin_purchase_today_balance,
            short: r.short_sale_today_balance
        })));

        const price = await pool.query("SELECT trade_date, close_price FROM daily_prices WHERE symbol = 'TAIEX' AND trade_date IN ('2025-12-24', '2025-12-31')");
        console.log('\nPRICE ROWS:');
        console.table(price.rows.map(r => ({
            date: r.trade_date.toISOString().split('T')[0],
            price: r.close_price
        })));

        // Also check if they exist under OTHERS names or dates
        const anyMargin = await pool.query("SELECT count(*) FROM fm_total_margin WHERE date >= '2025-12-20' AND date <= '2026-01-05'");
        console.log(`\nTotal margin rows in Dec range: ${anyMargin.rows[0].count}`);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
run();
