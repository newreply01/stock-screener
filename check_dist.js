const { pool } = require('./server/db');

async function check() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT LENGTH(symbol) as len, count(*) 
            FROM daily_prices 
            WHERE trade_date = (SELECT MAX(trade_date) FROM daily_prices) 
            GROUP BY LENGTH(symbol) 
            ORDER BY len
        `);
        console.log('--- Symbol Length Distribution (Latest Date) ---');
        console.table(res.rows);

        const res2 = await client.query(`
            SELECT symbol, name 
            FROM stocks s
            JOIN daily_prices p ON s.symbol = p.symbol
            WHERE p.trade_date = (SELECT MAX(trade_date) FROM daily_prices)
            AND LENGTH(s.symbol) > 4
            LIMIT 5
        `);
        console.log('\n--- Sample non-standard symbols ---');
        console.table(res2.rows);

    } catch (e) {
        console.error(e.message);
    } finally {
        client.release();
        process.exit(0);
    }
}

check();
