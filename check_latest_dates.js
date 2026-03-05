const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:postgres123@localhost:5432/stock_screener' });

async function check() {
    try {
        console.log('--- Latest Dates in daily_prices ---');
        const res1 = await pool.query("SELECT DISTINCT trade_date FROM daily_prices ORDER BY trade_date DESC LIMIT 5");
        console.table(res1.rows);

        console.log('--- Latest Dates in institutional ---');
        const res2 = await pool.query("SELECT DISTINCT trade_date FROM institutional ORDER BY trade_date DESC LIMIT 5");
        console.table(res2.rows);

        console.log('--- Count of symbols in latest daily_prices ---');
        if (res1.rows.length > 0) {
            const latest = res1.rows[0].trade_date;
            const res3 = await pool.query("SELECT count(*) FROM daily_prices WHERE trade_date = $1", [latest]);
            console.log(`Latest Date: ${latest.toISOString().split('T')[0]}, Count: ${res3.rows[0].count}`);
        }

    } catch (e) {
        console.error(e.message);
    } finally {
        await pool.end();
        process.exit(0);
    }
}
check();
