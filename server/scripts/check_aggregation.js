
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5432, ssl: false
});

async function run() {
    try {
        console.log('--- Fast Granularity Check (institutional_2025) ---');
        
        const dupCheck = await pool.query(`
            SELECT symbol, trade_date, count(*) 
            FROM institutional_2025 
            GROUP BY symbol, trade_date 
            HAVING count(*) > 1 
            LIMIT 1
        `);
        
        if (dupCheck.rows.length === 0) {
            console.log('Result: UNIQUE constraint seems to hold. The data is ALREADY at one record per stock per day.');
        } else {
            console.log('Result: Data is NOT aggregated. Found multiple records per stock per day.');
            const { symbol, trade_date } = dupCheck.rows[0];
            const detail = await pool.query(`SELECT * FROM institutional_2025 WHERE symbol = $1 AND trade_date = $2`, [symbol, trade_date]);
            console.log(JSON.stringify(detail.rows, null, 2));
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}
run();
