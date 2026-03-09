
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5432, ssl: false
});

async function run() {
    try {
        console.log('--- Institutional stats ---');
        const res = await pool.query('SELECT count(*) FROM institutional_2025');
        console.log(`Total rows in institutional_2025: ${res.rows[0].count}`);
        
        const marketRes = await pool.query('SELECT count(DISTINCT trade_date) FROM institutional_2025');
        console.log(`Total trading days in 2025: ${marketRes.rows[0].count}`);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
run();
