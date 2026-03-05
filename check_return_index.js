const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres:postgres123@localhost:5432/stock_screener'
});

async function run() {
    try {
        console.log('--- fm_total_return_index Sample ---');
        const res = await pool.query("SELECT * FROM fm_total_return_index ORDER BY date DESC LIMIT 10");
        console.table(res.rows);

        console.log('\n--- TAIEX in stocks ---');
        const res2 = await pool.query("SELECT * FROM stocks WHERE symbol = 'TAIEX'");
        console.table(res2.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
