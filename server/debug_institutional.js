const { query } = require('./db');

async function debugInstitutional() {
    try {
        const type = 'foreign';
        const field = 'foreign_net';
        const days = 3;

        const datesRes = await query(`
            SELECT DISTINCT trade_date 
            FROM institutional 
            ORDER BY trade_date DESC 
            LIMIT $1`, [days]);
        const targetDates = datesRes.rows.map(r => r.trade_date);

        console.log('--- BUY RANKING ---');
        const buyRes = await query(`
            SELECT i.symbol, s.name, SUM(i.${field}) as net_buy
            FROM institutional i
            JOIN stocks s ON i.symbol = s.symbol
            WHERE i.trade_date = ANY($1)
            GROUP BY i.symbol, s.name
            HAVING SUM(i.${field}) > 0
            ORDER BY net_buy DESC
            LIMIT 5
        `, [targetDates]);
        buyRes.rows.forEach(r => console.log(`${r.symbol} ${r.name}: ${r.net_buy}`));

        console.log('\n--- SELL RANKING ---');
        const sellRes = await query(`
            SELECT i.symbol, s.name, SUM(i.${field}) as net_buy
            FROM institutional i
            JOIN stocks s ON i.symbol = s.symbol
            WHERE i.trade_date = ANY($1)
            GROUP BY i.symbol, s.name
            HAVING SUM(i.${field}) < 0
            ORDER BY net_buy ASC
            LIMIT 5
        `, [targetDates]);
        sellRes.rows.forEach(r => console.log(`${r.symbol} ${r.name}: ${r.net_buy}`));

    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

debugInstitutional();
