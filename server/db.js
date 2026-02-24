const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' && process.env.DATABASE_URL.includes('render') // 簡單判斷，本機通常不需 SSL
        ? { rejectUnauthorized: false }
        : false
});

async function initDatabase() {
    const client = await pool.connect();
    try {
        const sql = fs.readFileSync(path.join(__dirname, '..', 'init-db.sql'), 'utf-8');
        await client.query(sql);
        console.log('✅ PostgreSQL 資料庫初始化完成');
    } catch (err) {
        console.error('❌ 資料庫初始化失敗:', err.message);
        throw err;
    } finally {
        client.release();
    }
}

async function query(text, params) {
    const result = await pool.query(text, params);
    return result;
}

if (require.main === module) {
    initDatabase()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { pool, query, initDatabase };
