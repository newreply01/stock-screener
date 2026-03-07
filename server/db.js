process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

const poolConfig = {
    connectionString: dbUrl,
    user: process.env.POSTGRES_USER || process.env.DB_USER,
    host: process.env.POSTGRES_HOST || process.env.DB_HOST,
    database: process.env.POSTGRES_DATABASE || process.env.DB_NAME,
    password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD,
    port: parseInt(process.env.POSTGRES_PORT || process.env.DB_PORT || '5432'),
    ssl: { 
        require: true,
        rejectUnauthorized: false 
    }
};

const pool = new Pool(poolConfig);

const query = (text, params) => pool.query(text, params);

const initDatabase = async () => {};

module.exports = { pool, query, initDatabase };
