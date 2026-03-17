const { pool } = require('./server/db');

async function run() {
    try {
        const res = await pool.query(`
            SELECT count(*) 
            FROM stocks s 
            JOIN daily_prices p ON s.symbol = p.symbol 
            WHERE length(s.symbol) = 4 
              AND p.trade_date = (SELECT max(trade_date) FROM daily_prices) 
              AND p.volume > 1000
        `);
        console.log('Active Standard Stocks (Vol > 1000):', res.rows[0].count);
        
        const top5 = await pool.query(`
            SELECT s.symbol, s.name, p.volume
            FROM stocks s 
            JOIN daily_prices p ON s.symbol = p.symbol 
            WHERE length(s.symbol) = 4 
              AND p.trade_date = (SELECT max(trade_date) FROM daily_prices) 
            ORDER BY p.volume DESC
            LIMIT 10
        `);
        console.log('Top 10 Stocks by Volume:');
        console.table(top5.rows);
        
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
run();
