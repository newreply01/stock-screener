const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'stock_screener',
    password: process.env.DB_PASSWORD || 'postgres123',
    port: parseInt(process.env.DB_PORT || '5432'),
});

async function checkSchema() {
    try {
        console.log('--- Indicators Table ---');
        const indRes = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'indicators' ORDER BY ordinal_position");
        indRes.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type}`));

        console.log('\n--- Stock Health Scores Table ---');
        const healthRes = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'stock_health_scores' ORDER BY ordinal_position");
        healthRes.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type}`));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

checkSchema();
