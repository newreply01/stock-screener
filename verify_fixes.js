const { query } = require('./server/db');

async function check() {
    try {
        console.log("Checking Market Margin data...");
        const result = await query(`
            SELECT * FROM (
                SELECT 
                    m.date::text as trade_date,
                    SUM(CASE WHEN m.name = 'MarginPurchaseMoney' THEN COALESCE(m.margin_purchase_today_balance, 0) ELSE 0 END)::bigint as margin_balance,
                    SUM(CASE WHEN m.name = 'ShortSale' THEN COALESCE(m.short_sale_today_balance, 0) ELSE 0 END)::bigint as short_balance,
                    MAX(p.close_price) as index_price
                FROM fm_total_margin m
                LEFT JOIN daily_prices p ON m.date = p.trade_date AND p.symbol = 'TAIEX'
                GROUP BY m.date
                ORDER BY m.date DESC
                LIMIT 5
            ) t ORDER BY t.trade_date ASC
        `);
        console.table(result.rows);
        
        console.log("Checking Institutional Ranking query...");
        const field = 'foreign_net';
        const isSell = false;
        const targetDates = ['2026-03-10', '2026-03-09', '2026-03-08']; // mock past 3 days
        
        const sql = `
            SELECT i.symbol, s.name, s.industry, s.market, SUM(i.${field}::numeric / 1000.0) as net_buy
            FROM institutional i
            JOIN stocks s ON i.symbol = s.symbol
            WHERE i.trade_date = ANY($1::date[])
            GROUP BY i.symbol, s.name, s.industry, s.market
            HAVING SUM(i.${field}) ${isSell ? '< 0' : '> 0'}
            ORDER BY net_buy ${isSell ? 'ASC' : 'DESC'}
            LIMIT 5
        `;
        const instRes = await query(sql, [targetDates]);
        console.table(instRes.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
check();
