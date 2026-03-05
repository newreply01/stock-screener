const { Pool } = require('pg');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URI;
const poolConfig = dbUrl
    ? { connectionString: dbUrl, ssl: false }
    : {
        user: process.env.POSTGRES_USER || 'postgres',
        host: process.env.POSTGRES_HOST || 'localhost',
        database: process.env.POSTGRES_DATABASE || 'stock_screener',
        password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'postgres123',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        ssl: false
    };

const pool = new Pool(poolConfig);

async function queryStatus() {
    try {
        const res = await pool.query(`SELECT * FROM system_status ORDER BY check_time DESC LIMIT 20;`);
        console.log(res.rows);
    } catch (err) {
        console.error('Error fetching system_status:', err.message);
    } finally {
        await pool.end();
    }
}

queryStatus();
