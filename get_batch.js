const { pool } = require('./server/db');
const fs = require('fs');

async function run() {
    try {
        const res = await pool.query(`
            SELECT s.symbol 
            FROM stocks s 
            JOIN daily_prices p ON s.symbol = p.symbol 
            WHERE length(s.symbol) = 4 
              AND p.trade_date = (SELECT max(trade_date) FROM daily_prices) 
            ORDER BY p.volume DESC
            LIMIT 5
        `);
        const symbols = res.rows.map(r => r.symbol);
        fs.writeFileSync(__dirname + '/batch_symbols.txt', symbols.join(','));
        console.log('✅ Batch symbols saved:', symbols.join(','));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
run();
