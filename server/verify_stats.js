const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:postgres123@localhost:5432/stock_screener' });

async function verify() {
    try {
        const res = await pool.query(`
            WITH latest AS (SELECT MAX(trade_date) FROM daily_prices)
            SELECT 
                COUNT(*) filter (where change_percent > 0) as up,
                COUNT(*) filter (where change_percent < 0) as down,
                (SELECT * FROM latest) as date
            FROM daily_prices
            WHERE trade_date = (SELECT * FROM latest)
        `);
        console.log(JSON.stringify(res.rows[0], null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
verify();
