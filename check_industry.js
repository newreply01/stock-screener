const { pool } = require('./server/db');

async function test() {
    try {
        const res = await pool.query("SELECT symbol, name, industry FROM stocks WHERE symbol ~ '^[0-9]{4}$' LIMIT 10;");
        console.log("Samples:", res.rows);

        const countRes = await pool.query("SELECT COUNT(*) FROM stocks WHERE industry IS NOT NULL AND industry != '';");
        console.log("Stocks with industry:", countRes.rows[0].count);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

test();
