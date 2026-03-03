const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres:postgres123@localhost:5432/stock_screener'
});

async function run() {
    try {
        console.log('--- Tables ---');
        const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log(tables.rows.map(r => r.table_name).join(', '));

        console.log('\n--- Metrics in fm_total_margin (latest sample) ---');
        const metrics = await pool.query(`
            SELECT DISTINCT ON (name) name, margin_purchase_today_balance, date 
            FROM fm_total_margin 
            ORDER BY name, date DESC
        `);
        console.table(metrics.rows);

        console.log('\n--- Search for Weighted Index in all symbols ---');
        const search = await pool.query(`
            SELECT symbol, name 
            FROM stocks 
            WHERE name LIKE '%加權%' OR name LIKE '%大盤%'
        `);
        console.table(search.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
