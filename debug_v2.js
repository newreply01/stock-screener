const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres:postgres123@localhost:5432/stock_screener'
});

async function debug() {
    try {
        console.log('=== 1. Check fm_total_margin column names ===');
        const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'fm_total_margin'");
        console.log(cols.rows.map(r => r.column_name).join(', '));

        console.log('\n=== 2. Check for daily_prices symbols with high counts (likely indexes) ===');
        const symbols = await pool.query(`
            SELECT symbol, count(*) 
            FROM daily_prices 
            GROUP BY symbol 
            ORDER BY count(*) DESC 
            LIMIT 50
        `);
        console.table(symbols.rows);

        console.log('\n=== 3. Check for specific index names in stocks table ===');
        const indexStocks = await pool.query("SELECT symbol, name FROM stocks WHERE name LIKE '%加權%' OR name LIKE '%指數%'");
        console.table(indexStocks.rows);

        console.log('\n=== 4. Check sample data for short balance names ===');
        const samples = await pool.query("SELECT * FROM fm_total_margin WHERE name LIKE '%Short%' LIMIT 5");
        console.table(samples.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
debug();
