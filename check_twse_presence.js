const { pool } = require('./server/db');

async function check() {
    const client = await pool.connect();
    try {
        const dates = ['2026-03-03', '2026-03-02', '2026-02-27'];
        for (const date of dates) {
            console.log(`\n--- Audit for ${date} ---`);
            const res = await client.query(`
                SELECT 
                    s.market,
                    count(*) FILTER (WHERE LENGTH(s.symbol) = 4) as len4,
                    count(*) FILTER (WHERE LENGTH(s.symbol) = 6) as len6
                FROM daily_prices p
                JOIN stocks s ON p.symbol = s.symbol
                WHERE p.trade_date = $1
                GROUP BY s.market
            `, [date]);
            console.table(res.rows);
        }

        console.log('\n--- Sample TWSE 4-digit stocks and their latest trade_date ---');
        const res2 = await client.query(`
            SELECT p.symbol, s.name, MAX(p.trade_date) as last_date
            FROM daily_prices p
            JOIN stocks s ON p.symbol = s.symbol
            WHERE s.market = 'twse' AND LENGTH(s.symbol) = 4
            GROUP BY p.symbol, s.name
            LIMIT 10
        `);
        console.table(res2.rows);

    } catch (e) {
        console.error(e.message);
    } finally {
        client.release();
        process.exit(0);
    }
}
check();
