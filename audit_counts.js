const { pool } = require('./server/db');

async function audit() {
    const client = await pool.connect();
    try {
        console.log('--- Stocks Table Summary ---');
        const res1 = await client.query(`
            SELECT market, count(*) as total,
                   count(*) FILTER (WHERE symbol ~ '^[0-9]{4}$') as len4,
                   count(*) FILTER (WHERE symbol ~ '^[0-9]{5}$') as len5,
                   count(*) FILTER (WHERE symbol ~ '^[0-9]{6}$') as len6
            FROM stocks
            GROUP BY market
        `);
        console.table(res1.rows);

        const latestDateRes = await client.query("SELECT MAX(trade_date) as max_date FROM daily_prices");
        const latestDate = latestDateRes.rows[0].max_date;
        console.log(`\n--- Daily Prices Summary (Latest: ${latestDate.toISOString().split('T')[0]}) ---`);

        const res2 = await client.query(`
            SELECT s.market, count(*) as total,
                   count(*) FILTER (WHERE s.symbol ~ '^[0-9]{4}$') as len4
            FROM daily_prices p
            JOIN stocks s ON p.symbol = s.symbol
            WHERE p.trade_date = $1
            GROUP BY s.market
        `, [latestDate]);
        console.table(res2.rows);

        console.log('\n--- Sample of 4-digit stocks in stocks table but NOT in latest daily_prices ---');
        const res3 = await client.query(`
            SELECT s.symbol, s.name, s.market
            FROM stocks s
            LEFT JOIN daily_prices p ON s.symbol = p.symbol AND p.trade_date = $1
            WHERE s.symbol ~ '^[0-9]{4}$' AND p.symbol IS NULL
            LIMIT 20
        `, [latestDate]);
        console.table(res3.rows);

    } catch (e) {
        console.error(e.message);
    } finally {
        client.release();
        process.exit(0);
    }
}

audit();
