const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// 支援多種連線字串變數名稱
const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URI;

const poolConfig = dbUrl 
    ? { 
        connectionString: dbUrl,
        ssl: dbUrl.includes('zeabur.cloud') || dbUrl.includes('sjc1.clusters.zeabur.com') || dbUrl.includes('amazonaws.com') 
          ? { rejectUnauthorized: false } 
          : false
      }
    : {
        // 支援 Zeabur 自動注入的 POSTGRES_* 變數以及手動的 DB_* 變數
        user: process.env.POSTGRES_USER || process.env.DB_USER || 'postgres',
        host: process.env.POSTGRES_HOST || process.env.DB_HOST || 'localhost',
        database: process.env.POSTGRES_DATABASE || process.env.DB_NAME || 'stock_screener',
        password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'postgres123',
        port: parseInt(process.env.POSTGRES_PORT || process.env.DB_PORT || '5432'),
    };

if (dbUrl) {
    const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ':****@');
    console.log(`📡 使用連線字串: ${maskedUrl}`);
} else {
    console.log(`📡 使用手動設定連線: ${poolConfig.host}:${poolConfig.port} (User: ${poolConfig.user}, DB: ${poolConfig.database})`);
}

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
            console.log(' ✅ 數據庫初始化成功');
        }
    } catch (err) {
        console.error(' ❌ 數據庫初始化失敗:', err.message);
        throw err;
    } finally {
        client.release();
    }
}

module.exports = { pool, query, initDatabase };
