const { pool } = require('./server/db');
async function check() {
    const client = await pool.connect();
    try {
        console.log('--- 4-digit symbols (Stock?) ---');
        const res4 = await client.query("SELECT symbol, name FROM stocks WHERE LENGTH(symbol) = 4 LIMIT 10");
        console.table(res4.rows);

        console.log('\n--- 5-digit symbols ---');
        const res5 = await client.query("SELECT symbol, name FROM stocks WHERE LENGTH(symbol) = 5 LIMIT 10");
        console.table(res5.rows);

        console.log('\n--- 6-digit symbols (Warrant/ETF?) ---');
        const res6 = await client.query("SELECT symbol, name FROM stocks WHERE LENGTH(symbol) = 6 LIMIT 20");
        console.table(res6.rows);

    } finally {
        client.release();
        process.exit(0);
    }
}
check();
