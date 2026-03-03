const { pool } = require('./server/db');

async function diag() {
    const client = await pool.connect();
    try {
        console.log('--- Checking Max Date ---');
        const res1 = await client.query("SELECT MAX(trade_date) as max_date FROM daily_prices");
        const latestDate = res1.rows[0].max_date;
        console.log('Latest Date in new table:', latestDate);

        console.log('\n--- Checking 2026-03-03 specifically ---');
        const res2 = await client.query(`
            SELECT s.market, count(*) 
            FROM daily_prices p
            JOIN stocks s ON p.symbol = s.symbol
            WHERE p.trade_date = '2026-03-03'
            GROUP BY s.market
        `);
        console.table(res2.rows);

        console.log('\n--- Checking 2026-03-02 specifically ---');
        const res3 = await client.query(`
            SELECT s.market, count(*) 
            FROM daily_prices p
            JOIN stocks s ON p.symbol = s.symbol
            WHERE p.trade_date = '2026-03-02'
            GROUP BY s.market
        `);
        console.table(res3.rows);

        console.log('\n--- Row counts in partitions (approx) ---');
        const res4 = await client.query(`
            SELECT relname, n_live_tup 
            FROM pg_stat_user_tables 
            WHERE relname LIKE 'daily_prices_y%'
            ORDER BY relname DESC
            LIMIT 5
        `);
        console.table(res4.rows);

        console.log('\n--- Check if TWSE stocks exist in ANY date in daily_prices ---');
        const res5 = await client.query(`
            SELECT count(distinct p.symbol)
            FROM daily_prices p
            JOIN stocks s ON p.symbol = s.symbol
            WHERE s.market = 'twse' AND LENGTH(s.symbol) = 4
        `);
        console.log('Unique TWSE 4-digit stocks in daily_prices:', res5.rows[0].count);

        console.log('\n--- Check daily_prices_old for comparison ---');
        const res6 = await client.query(`
            SELECT count(distinct symbol) 
            FROM daily_prices_old 
            WHERE symbol ~ '^[0-9]{4}$'
        `);
        console.log('Unique 4-digit symbols in OLD table:', res6.rows[0].count);

    } catch (e) {
        console.error(e.message);
    } finally {
        client.release();
        process.exit(0);
    }
}

diag();
