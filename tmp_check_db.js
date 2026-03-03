const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:postgres123@localhost:5432/stock_screener'
});

async function check() {
    try {
        console.log('--- Checking fm_total_margin records ---');
        const marginNames = await pool.query('SELECT name, count(*) FROM fm_total_margin GROUP BY name');
        console.table(marginNames.rows);

        console.log('\n--- Checking daily_prices TAIEX records ---');
        const taiexCount = await pool.query("SELECT count(*) FROM daily_prices WHERE symbol = 'TAIEX'");
        console.table(taiexCount.rows);

        console.log('\n--- Fetching sample market-margin data (JOIN check) ---');
        const sampleSql = `
            SELECT 
                m.date as trade_date, 
                MAX(CASE WHEN m.name = 'MarginPurchaseMoney' THEN m.margin_purchase_today_balance ELSE 0 END) as margin_balance,
                MAX(CASE WHEN m.name = 'MarginShortMoney' THEN m.margin_purchase_today_balance ELSE 0 END) as short_balance,
                p.close_price as index_price
            FROM fm_total_margin m
            LEFT JOIN daily_prices p 
                ON m.date = p.trade_date AND p.symbol = 'TAIEX'
            WHERE m.name IN ('MarginPurchaseMoney', 'MarginShortMoney')
            GROUP BY m.date, p.close_price
            ORDER BY m.date DESC
            LIMIT 5
        `;
        const sampleRes = await pool.query(sampleSql);
        console.table(sampleRes.rows);

    } catch (err) {
        console.error('Check failed:', err);
    } finally {
        await pool.end();
    }
}

check();
