const { Pool } = require('pg');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

const poolConfig = dbUrl 
    ? { 
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false } 
      }
    : {
        user: process.env.POSTGRES_USER || process.env.DB_USER,
        host: process.env.POSTGRES_HOST || process.env.DB_HOST,
        database: process.env.POSTGRES_DATABASE || process.env.DB_NAME,
        password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD,
        port: parseInt(process.env.POSTGRES_PORT || process.env.DB_PORT || '5432'),
        ssl: (process.env.POSTGRES_HOST || '').includes('supabase') ? { rejectUnauthorized: false } : false
    };

const pool = new Pool(poolConfig);

const query = (text, params) => pool.query(text, params);

const initDatabase = async () => {};

module.exports = { pool, query, initDatabase };
