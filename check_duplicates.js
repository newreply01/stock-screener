const { pool } = require('./server/db');

async function check() {
    const client = await pool.connect();
    try {
        console.log('--- Checking for duplicates in institutional ---');
        const res = await client.query(`
            SELECT symbol, trade_date, count(*) 
            FROM institutional 
            GROUP BY symbol, trade_date 
            HAVING count(*) > 1 
            LIMIT 10
        `);
        console.log('Duplicates found:', res.rows.length);
        res.rows.forEach(r => console.log(`  ${r.symbol} on ${r.trade_date.toISOString().split('T')[0]}: ${r.count} rows`));

        console.log('\n--- Checking for duplicates in daily_prices ---');
        const res2 = await client.query(`
            SELECT symbol, trade_date, count(*) 
            FROM daily_prices 
            GROUP BY symbol, trade_date 
            HAVING count(*) > 1 
            LIMIT 10
        `);
        console.log('Duplicates found:', res2.rows.length);
        res2.rows.forEach(r => console.log(`  ${r.symbol} on ${r.trade_date.toISOString().split('T')[0]}: ${r.count} rows`));

    } catch (e) {
        console.error(e.message);
    } finally {
        client.release();
        process.exit(0);
    }
}

check();
