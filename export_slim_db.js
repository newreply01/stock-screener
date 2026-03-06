// export_slim_db.js
// 這支腳本會在本機產生一個 slim_db.sql，包含所有結構(Schema)，
// 但大型資料表只保留最近一年的資料，以控制在 500MB 以下。

const { execSync } = require('child_process');
const { pool } = require('./server/db');
const fs = require('fs');

async function exportSlimDB() {
    console.log("🚀 開始產生瘦身版資料庫匯出檔 (slim_db.sql)...");

    // 1. 取得大型分區表的清單
    const res = await pool.query(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    `);
    const allTables = res.rows.map(r => r.tablename);

    // 我們要排除完整匯出的資料表名單
    // 策略：
    // - institutional_2021~2024: 不匯出資料
    // - daily_prices_2021~2024: 不匯出資料
    // - realtime_ticks_*: 只匯出最新的 1~2 天
    // - fm_stock_price: 另外用 COPY 匯出 2025 以後
    // - institutional_old_backup / daily_prices_old_backup: 忽略

    // 找出所有要加上 --exclude-table-data 的表
    const excludeDataFlags = [];
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '_'); // e.g. 2026_03_05
    let latestTickTable = '';

    allTables.forEach(t => {
        // 舊法人與日K不匯出資料
        // 舊法人與日K不匯出資料 (排除 2024 以前，保留 2025-2026)
        if (t.match(/^institutional_(2021|2022|2023|2024)$/)) excludeDataFlags.push(`-T "${t}"`);
        if (t.match(/^daily_prices_(2021|2022|2023|2024)$/)) excludeDataFlags.push(`-T "${t}"`);

        // 舊備份不匯出結構跟資料
        if (t.includes('_old_backup')) {
            excludeDataFlags.push(`-T "${t}"`);
        }

        // Ticks 表全部不匯出資料 (用戶要求去掉 realtime_ticks)
        if (t.startsWith('realtime_ticks_')) {
            excludeDataFlags.push(`-T "${t}"`);
        }

        // fm_stock_price 太大，我們排除它，稍後手動匯出
        if (t === 'fm_stock_price') excludeDataFlags.push(`-T "${t}"`);
    });

    const excludeString = excludeDataFlags.join(' ');

    const pgHost = process.env.DB_HOST || '127.0.0.1';
    const pgPort = process.env.DB_PORT || '5432';
    const pgUser = process.env.DB_USER || 'postgres';
    const pgPass = process.env.DB_PASSWORD || 'postgres123';
    const pgDb = process.env.DB_NAME || 'stock_screener';
    const env = { ...process.env, PGPASSWORD: pgPass };

    try {
        // Step 1: 匯出 Schema (全部結構)
        console.log("📦 1/3 匯出資料庫結構與預設全表資料...");
        const dumpCmd = `pg_dump -h ${pgHost} -p ${pgPort} -U ${pgUser} -d ${pgDb} ${excludeString} -f /tmp/slim_db.sql`;
        execSync(dumpCmd, { stdio: 'inherit', env });

        // Step 2: 針對部分大表 (如 fm_stock_price) 補充近期資料
        console.log("📦 2/3 手動匯出 fm_stock_price (2025~) 資料...");
        // 將 2025-01-01 以後的資料以 INSERT 形式追加到 sql 檔案尾端
        const copySql = `\\copy (SELECT * FROM fm_stock_price WHERE date >= '2025-01-01') TO STDOUT WITH CSV HEADER`;
        const psqlCmd = `psql -h ${pgHost} -p ${pgPort} -U ${pgUser} -d ${pgDb} -c "${copySql}" > /tmp/fm_stock_price_data.csv`;
        execSync(psqlCmd, { env });

        // 追加一個 COPY 指令到 SQL 檔
        fs.appendFileSync('/tmp/slim_db.sql', `\n\\copy fm_stock_price FROM stdin WITH CSV HEADER;\n`);
        const csvData = fs.readFileSync('/tmp/fm_stock_price_data.csv');
        fs.appendFileSync('/tmp/slim_db.sql', csvData);
        fs.appendFileSync('/tmp/slim_db.sql', `\\.\n`);

        console.log("✅ 瘦身版匯出成功！檔案位於 /tmp/slim_db.sql");
        const stats = fs.statSync('/tmp/slim_db.sql');
        console.log(`📊 檔案大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    } catch (e) {
        console.error("匯出失敗:", e.message);
    } finally {
        pool.end();
    }
}

exportSlimDB();
