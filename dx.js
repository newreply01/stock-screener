const { Pool } = require('pg');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URI;
const pool = new Pool({
    connectionString: dbUrl,
    ssl: false
});

async function diagnostic() {
    try {
        const tables = ['daily_prices', 'institutional', 'fm_margin_trading', 'news', 'financial_statements', 'monthly_revenue'];
        for (const t of tables) {
            const res = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = '${t}'`);
            console.log(`Table: ${t} | Columns: ${res.rows.map(r => r.column_name).join(', ')}`);
        }
    } catch (err) {
        console.error('Error during diagnostic:', err);
    } finally {
        await pool.end();
    }
}

diagnostic();
