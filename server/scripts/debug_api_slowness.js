const { query } = require('../db');

async function debugSlowness() {
    console.log('Checking table statistics...');
    try {
        const counts = await query(`
            SELECT 
                (SELECT count(*) FROM fm_total_margin) as total_margin_count,
                (SELECT count(*) FROM daily_prices) as daily_prices_count
        `);
        console.log('Counts:', counts.rows[0]);

        console.log('Checking indexes on relevant tables...');
        const indexes = await query(`
            SELECT tablename, indexname, indexdef
            FROM pg_indexes
            WHERE tablename IN ('fm_total_margin', 'daily_prices', 'stocks')
        `);
        console.log('Indexes:', JSON.stringify(indexes.rows, null, 2));

        console.log('Timing the current API query...');
        const start = Date.now();
        const sql = `
            SELECT 
                m.date::text as trade_date,
                SUM(COALESCE(m.margin_purchase_today_balance, 0))::bigint as margin_balance,
                SUM(COALESCE(m.short_sale_today_balance, 0))::bigint as short_balance,
                MAX(p.close_price) as index_price
            FROM fm_total_margin m
            LEFT JOIN daily_prices p ON m.date = p.trade_date 
            AND p.symbol = (SELECT symbol FROM stocks WHERE name LIKE '%加權%' LIMIT 1)
            GROUP BY m.date
            ORDER BY m.date ASC
            LIMIT 200
        `;
        const res = await query(sql);
        const end = Date.now();
        console.log(`Query took ${end - start}ms. Returned ${res.rowCount} rows.`);

        if (res.rowCount > 0) {
            console.log('First row:', res.rows[0]);
            console.log('Last row:', res.rows[res.rows.length - 1]);
        }

        process.exit(0);
    } catch (err) {
        console.error('Error debugging slowness:', err);
        process.exit(1);
    }
}

debugSlowness();
