const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const poolConfig = process.env.DATABASE_URL 
    ? { 
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes('zeabur.cloud') || process.env.DATABASE_URL.includes('amazonaws.com') 
          ? { rejectUnauthorized: false } 
          : false
      }
    : {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'stock_screener',
        password: process.env.DB_PASSWORD || 'postgres123',
        port: parseInt(process.env.DB_PORT || '5432'),
    };

const pool = new Pool(poolConfig);

async function query(text, params) {
    return pool.query(text, params);
}

async function initDatabase() {
    const client = await pool.connect();
    try {
        const sqlPath = path.join(__dirname, '..', 'init-db.sql');
        if (fs.existsSync(sqlPath)) {
            const sql = fs.readFileSync(sqlPath, 'utf8');
            await client.query(sql);
            console.log(' 數據庫初始化成功');
        }
    } catch (err) {
        console.error(' 數據庫初始化失敗:', err.message);
        throw err;
    } finally {
        client.release();
    }
}

module.exports = { pool, query, initDatabase };
