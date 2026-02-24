const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// 偵錯日誌：列出所有相關的環境變數 (隱藏敏感資訊)
console.log('🔍 偵測資料庫環境變數:');
const envKeys = ['DATABASE_URL', 'POSTGRES_URL', 'POSTGRES_URI', 'POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_USER', 'POSTGRES_DATABASE', 'DB_HOST', 'DB_PORT'];
envKeys.forEach(key => {
    if (process.env[key]) {
        let val = process.env[key];
        if (key.includes('URL') || key.includes('URI') || key.includes('PASSWORD')) {
            val = val.replace(/:([^:@]+)@/, ':****@');
        }
        console.log(`  - ${key}: ${val}`);
    }
});

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URI;

const poolConfig = dbUrl 
    ? { 
        connectionString: dbUrl,
        ssl: false // 已確認 sjc1.clusters.zeabur.com 不支援 SSL，強制關閉以修復連線
      }
    : {
        user: process.env.POSTGRES_USER || process.env.DB_USER || 'postgres',
        host: process.env.POSTGRES_HOST || process.env.DB_HOST || 'localhost',
        database: process.env.POSTGRES_DATABASE || process.env.DB_NAME || 'stock_screener',
        password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'postgres123',
        port: parseInt(process.env.POSTGRES_PORT || process.env.DB_PORT || '5432'),
        ssl: false // 同步關閉手動連線設定的 SSL
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
