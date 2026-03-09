const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'stock_screener',
    password: 'postgres123',
    port: 5432
});

async function checkGaps() {
    try {
        console.log('--- Checking Margin Data Gaps (Dec 2025 - Mar 2026) ---');
        
        const sql = `
            SELECT 
                m.date::date as date, 
                SUM(CASE WHEN m.name = 'MarginPurchaseMoney' THEN 1 ELSE 0 END) as money_count,
                SUM(CASE WHEN m.name = 'ShortSale' THEN 1 ELSE 0 END) as short_count,
                COUNT(p.close_price) as index_price_exists
            FROM fm_total_margin m
            LEFT JOIN daily_prices p ON m.date = p.trade_date AND p.symbol = 'TAIEX'
            WHERE m.date >= '2025-12-01' AND m.date <= '2026-03-08'
            GROUP BY m.date
            ORDER BY m.date;
        `;
        
        const res = await pool.query(sql);
        
        if (res.rows.length === 0) {
            console.log('No data found in range.');
        } else {
            console.table(res.rows.map(r => ({
                date: r.date.toISOString().split('T')[0],
                money: r.money_count,
                short: r.short_count,
                index: r.index_price_exists > 0 ? 'YES' : 'NO'
            })));
        }

        console.log('\n--- Missing Dates Detection ---');
        // Simple gap detection between first and last date
        const dates = res.rows.map(r => new Date(r.date));
        if (dates.length > 1) {
            const start = dates[0];
            const end = dates[dates.length - 1];
            let curr = new Date(start);
            while (curr <= end) {
                const dateStr = curr.toISOString().split('T')[0];
                const found = res.rows.some(r => r.date.toISOString().split('T')[0] === dateStr);
                
                // Skip weekends (approximate)
                const day = curr.getDay();
                if (!found && day !== 0 && day !== 6) {
                    console.log(`Missing Data on: ${dateStr} (Weekday)`);
                }
                curr.setDate(curr.getDate() + 1);
            }
        }

    } catch (err) {
        console.error('Error checking gaps:', err);
    } finally {
        await pool.end();
    }
}

checkGaps();
