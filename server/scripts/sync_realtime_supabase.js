const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// 本地資料庫連線
const localPool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'stock_screener',
  password: process.env.DB_PASSWORD || 'postgres123',
  port: parseInt(process.env.DB_PORT || '5533'),
});

// 遠端 Supabase 連線 (優先使用專屬變數，否則使用預設值)
const remotePool = new Pool({
  connectionString: process.env.SUPABASE_URL || 'postgresql://postgres.gfwlifpmstidgudgojwe:HfSDHrdekEY0vLPz@aws-1-us-east-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function sync() {
    console.log(`[Sync-Supabase] 🚀 開始檢查並同步最新 Ticks...`);
    
    try {
        // 1. 取得 Supabase 目前最大的 ID
        const remoteRes = await remotePool.query("SELECT MAX(id) as max_id FROM realtime_ticks");
        const lastRemoteId = remoteRes.rows[0].max_id || 0;
        console.log(`[Sync-Supabase] 遠端目前最大 ID: ${lastRemoteId}`);

        // 2. 從本地抓取比該 ID 大的資料 (分批處理)
        const batchSize = 1000;
        const localRes = await localPool.query(
            "SELECT * FROM realtime_ticks WHERE id > $1 ORDER BY id ASC LIMIT $2",
            [lastRemoteId, batchSize]
        );

        if (localRes.rows.length === 0) {
            console.log(`[Sync-Supabase] ✅ 目前沒有新資料需要同步。`);
            return;
        }

        console.log(`[Sync-Supabase] 📥 發現 ${localRes.rows.length} 筆新資料，正在上傳至 Supabase...`);

        // 3. 批次寫入 Supabase
        // 這裡使用多行插入語法優化效能
        const rows = localRes.rows;
        const columns = [
            'id', 'symbol', 'trade_time', 'price', 'open_price', 'high_price', 'low_price', 
            'volume', 'trade_volume', 'buy_intensity', 'sell_intensity', 'five_levels', 'previous_close'
        ];
        
        const values = [];
        const placeholders = [];
        let index = 1;

        for (const row of rows) {
            const rowPlaceholders = [];
            for (const col of columns) {
                let val = row[col];
                // 處理 JSONB 欄位序列化
                if (col === 'five_levels' && val !== null && typeof val === 'object') {
                    val = JSON.stringify(val);
                }
                values.push(val);
                rowPlaceholders.push(`$${index++}`);
            }
            placeholders.push(`(${rowPlaceholders.join(',')})`);
        }

        const sql = `
            INSERT INTO realtime_ticks (${columns.join(',')})
            VALUES ${placeholders.join(', ')}
            ON CONFLICT (symbol, trade_time) DO NOTHING
        `;

        await remotePool.query(sql, values);
        console.log(`[Sync-Supabase] ✨ 已成功同步 ${rows.length} 筆資料 (最後 ID: ${rows[rows.length-1].id})`);

    } catch (err) {
        console.error(`[Sync-Supabase] ❌ 同步失敗:`, err.message);
    }
}

// 如果直接執行此腳本
if (require.main === module) {
    sync().then(() => {
        // 這裡設定如果是手動執行則完成後結束
        localPool.end();
        remotePool.end();
    });
}

module.exports = { sync };
