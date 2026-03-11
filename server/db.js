process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

const host = process.env.POSTGRES_HOST || process.env.DB_HOST || 'localhost';
const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

// 辨識是否為本地或內網 IP
const isPrivateIP = (ip) => {
    if (ip === 'localhost' || ip === '127.0.0.1' || ip === '::1') return true;
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    const first = parseInt(parts[0], 10);
    const second = parseInt(parts[1], 10);
    if (first === 10) return true; // 10.0.0.0/8
    if (first === 172 && second >= 16 && second <= 31) return true; // 172.16.0.0/12
    if (first === 192 && second === 168) return true; // 192.168.0.0/16
    return false;
};

const isLocalNetwork = isPrivateIP(host);

// 優先級：明確的環境變數 > Vercel 雲端判定 > 自動辨識 (非內網 DB 預設開啟 SSL)
let useSSL = isVercel || !isLocalNetwork;
if (process.env.DB_SSL === 'true') useSSL = true;
if (process.env.DB_SSL === 'false') useSSL = false;

const poolConfig = {
    connectionString: dbUrl,
    user: process.env.POSTGRES_USER || process.env.DB_USER,
    host: host,
    database: process.env.POSTGRES_DATABASE || process.env.DB_NAME,
    password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD,
    port: parseInt(process.env.POSTGRES_PORT || process.env.DB_PORT || '5432'),
    ssl: useSSL ? { 
        require: true,
        rejectUnauthorized: false 
    } : false
};

const pool = new Pool(poolConfig);

const query = (text, params) => pool.query(text, params);

const initDatabase = async () => {};

module.exports = { pool, query, initDatabase };
