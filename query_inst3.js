const { query } = require('./server/db');

async function check() {
    try {
        const days = 3;
        const type = 'foreign';
        const isSell = false;
        
        console.log("1. Fetching valid dates...");
        const datesRes = await query(`
            SELECT trade_date, count(*) as c
            FROM institutional 
            GROUP BY trade_date
            HAVING count(*) > 1000
            ORDER BY trade_date DESC 
            LIMIT $1`, [days]);
            
        console.table(datesRes.rows);
        
        if (datesRes.rows.length === 0) {
            console.log("No dates found > 1000 count!");
            return;
        }
        
        const targetDates = datesRes.rows.map(r => r.trade_date);
        console.log("Target dates:", targetDates);
        
        const sql = `
            SELECT i.symbol, s.name, s.industry, s.market, SUM(i.foreign_net::numeric / 1000.0) as net_buy
            FROM institutional i
            JOIN stocks s ON i.symbol = s.symbol
            WHERE i.trade_date = ANY($1::date[])
            AND (s.symbol ~ '^[0-9]{4}$' AND s.symbol !~ '^00')
            GROUP BY i.symbol, s.name, s.industry, s.market
            HAVING SUM(i.foreign_net) > 0
            ORDER BY net_buy DESC
            LIMIT 5
        `;
        
        console.log("2. Fetching institutional ranks...");
        const result = await query(sql, [targetDates]);
        console.table(result.rows);
        
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
check();
