const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres:postgres123@localhost:5432/stock_screener'
});

async function main() {
    try {
        console.log('--- 1. Search for 加權 in stocks ---');
        const s1 = await pool.query("SELECT symbol, name FROM stocks WHERE name LIKE '%加權%'");
        console.table(s1.rows);

        console.log('\n--- 2. Search for common index symbols ---');
        const s2 = await pool.query("SELECT symbol, name FROM stocks WHERE symbol IN ('IX0001', '0000', 'TAIEX', 'TSE', 'Y9999', 'TWII')");
        console.table(s2.rows);

        console.log('\n--- 3. Verify data in daily_prices for those symbols ---');
        if (s1.rows.length > 0 || s2.rows.length > 0) {
            const syms = [...new Set([...s1.rows, ...s2.rows].map(r => r.symbol))];
            const s3 = await pool.query("SELECT symbol, count(*), MAX(trade_date) FROM daily_prices WHERE symbol = ANY($1) GROUP BY symbol", [syms]);
            console.table(s3.rows);
        }

        console.log('\n--- 4. Check MarginShortMoney columns in fm_total_margin ---');
        const s4 = await pool.query(`
            SELECT 
                margin_purchase_today_balance as p_bal, 
                margin_short_today_balance as s_bal,
                count(*)
            FROM fm_total_margin 
            WHERE name = 'MarginShortMoney'
            GROUP BY margin_purchase_today_balance, margin_short_today_balance
            LIMIT 10
        `);
        console.table(s4.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
main();
