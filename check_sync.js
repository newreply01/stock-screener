const { pool } = require('./server/db');

async function check() {
    try {
        const rev = await pool.query('SELECT COUNT(DISTINCT symbol) FROM monthly_revenue');
        const eps = await pool.query('SELECT COUNT(DISTINCT symbol) FROM financial_statements');
        const div = await pool.query('SELECT COUNT(DISTINCT symbol) FROM dividend_policy');
        const total = await pool.query('SELECT COUNT(*) FROM stocks');

        console.log(`📊 Sync Progress Report:`);
        console.log(`- Total stocks in DB: ${total.rows[0].count}`);
        console.log(`- Stocks with Revenue data: ${rev.rows[0].count}`);
        console.log(`- Stocks with EPS data: ${eps.rows[0].count}`);
        console.log(`- Stocks with Dividend data: ${div.rows[0].count}`);

        process.exit(0);
    } catch (err) {
        console.error('❌ Check failed:', err);
        process.exit(1);
    }
}

check();
