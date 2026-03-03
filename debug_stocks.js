const { pool } = require('./server/db');

async function debug() {
    const client = await pool.connect();
    try {
        console.log('--- Checking for duplicates in stocks ---');
        const res = await client.query(`
            SELECT symbol, count(*) 
            FROM stocks 
            GROUP BY symbol 
            HAVING count(*) > 1 
            LIMIT 10
        `);
        console.log('Duplicate symbols:', res.rows.length);
        res.rows.forEach(r => console.log(`  Symbol ${r.symbol}: ${r.count} occurrences`));

        const res2 = await client.query('SELECT count(*) FROM stocks');
        console.log('Total rows in stocks:', res2.rows[0].count);

        if (res.rows.length > 0) {
            const firstDup = res.rows[0].symbol;
            const res3 = await client.query('SELECT * FROM stocks WHERE symbol = $1', [firstDup]);
            console.log(`\nSample data for duplicated symbol [${firstDup}]:`);
            console.table(res3.rows);
        }

    } catch (e) {
        console.error(e.message);
    } finally {
        client.release();
        process.exit(0);
    }
}

debug();
