const { pool } = require('./server/db');
const fs = require('fs');

async function run() {
    try {
        const res = await pool.query(`
            SELECT s.symbol 
            FROM stocks s 
            LEFT JOIN daily_prices p ON s.symbol = p.symbol 
            WHERE s.industry IS NOT NULL 
              AND s.industry NOT IN ('存託憑證', '封閉式基金', '上櫃ETF基金', '認購權證', '認售權證')
              AND (p.trade_date = (SELECT max(trade_date) FROM daily_prices) OR p.trade_date IS NULL)
            ORDER BY COALESCE(p.volume, 0) DESC
        `);
        const symbols = res.rows.map(r => r.symbol);
        fs.writeFileSync(__dirname + '/mass_symbols.txt', symbols.join(','));
        console.log('✅ Final mass list saved. Total count:', symbols.length);
        console.log('Top 10 to process:', symbols.slice(0, 10).join(', '));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
run();
