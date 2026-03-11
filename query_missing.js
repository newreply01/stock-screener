const { query } = require('./server/db');

async function main() {
    try {
        const res = await query(`
            SELECT symbol, close_price, trade_date 
            FROM daily_prices 
            WHERE symbol IN ('1701', '2358') 
            ORDER BY trade_date DESC LIMIT 5;
        `);
        console.log(res.rows);
        process.exit(0);
    } catch(e) { console.error(e); process.exit(1); }
}

main();
