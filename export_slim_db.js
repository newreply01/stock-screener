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
        // 舊備份或不需要的表，完全排除結構與資料
        if (t.includes('_old_backup') || t.match(/^institutional_(2021|2022|2023|2024)$/) || t.match(/^daily_prices_(2021|2022|2023|2024)$/) || t.startsWith('realtime_ticks_')) {
            excludeDataFlags.push(`-T "${t}"`);
        }

        // fm_stock_price 需要結構，但資料我們先排除，稍後手動追加
        if (t === 'fm_stock_price') {
            excludeDataFlags.push(`--exclude-table-data="${t}"`);
        }
    });

    const excludeString = excludeDataFlags.join(' ');

    const pgHost = process.env.DB_HOST || '127.0.0.1';
    const pgPort = process.env.DB_PORT || '5432';
    const pgUser = process.env.DB_USER || 'postgres';
    const pgPass = process.env.DB_PASSWORD || 'postgres123';
    const pgDb = process.env.DB_NAME || 'stock_screener';
    const env = { ...process.env, PGPASSWORD: pgPass };

    try {
        // Step 1: 匯出 Schema + 預設資料 (排除大型表資料)
        console.log("📦 1/3 匯出資料庫結構與預設全表資料...");
        // -O: no-owner, -x: no-privileges, --no-security-labels, --no-comments
        const dumpCmd = `pg_dump -h ${pgHost} -p ${pgPort} -U ${pgUser} -d ${pgDb} -O -x --no-security-labels --no-privileges --no-comments ${excludeString} -f /tmp/slim_db.sql`;
        execSync(dumpCmd, { stdio: 'inherit', env });

        // Step 1.5: 插入 DROP 區塊
        console.log("🛠️  插入 DROP TABLE & SEQUENCE 區塊...");
        const dropTables = allTables
            .filter(t => !t.match(/^(institutional|daily_prices|realtime_ticks)_.*/))
            .filter(t => !['institutional', 'daily_prices', 'realtime_ticks'].includes(t))
            .map(t => `DROP TABLE IF EXISTS public."${t}" CASCADE;`)
            .join('\n');
            
        const dropMain = ['institutional', 'daily_prices', 'realtime_ticks', 'fm_stock_price']
            .map(t => `DROP TABLE IF EXISTS public."${t}" CASCADE;`)
            .join('\n');

        const dropSeqs = [
            'DROP SEQUENCE IF EXISTS public.realtime_ticks_id_seq CASCADE;',
            'DROP SEQUENCE IF EXISTS public.users_id_seq CASCADE;',
            'DROP SEQUENCE IF EXISTS public.watchlists_id_seq CASCADE;',
            'DROP SEQUENCE IF EXISTS public.saved_filters_id_seq CASCADE;'
        ].join('\n');

        const originalContent = fs.readFileSync('/tmp/slim_db.sql', 'utf8');
        const finalContent = `-- Stock Screener Slim DB Export\n-- Cleanup existing\n${dropSeqs}\n${dropTables}\n${dropMain}\n\n${originalContent}`;
        fs.writeFileSync('/tmp/slim_db.sql', finalContent);

        // Step 2: 針對 fm_stock_price 補充近期資料
        console.log("📦 2/3 手動匯出 fm_stock_price (2025~) 資料...");
        const copySql = `COPY (SELECT * FROM fm_stock_price WHERE date >= '2025-01-01') TO STDOUT WITH CSV`;
        // 用 CSV 格式匯出，不帶 Header，因為我們手動寫 COPY 指令
        const psqlCmd = `psql -h ${pgHost} -p ${pgPort} -U ${pgUser} -d ${pgDb} -c "${copySql}" > /tmp/fm_stock_price_data.csv`;
        execSync(psqlCmd, { env });

        // 追加一個 COPY 指令到 SQL 檔
        fs.appendFileSync('/tmp/slim_db.sql', `\n-- 手動追加 fm_stock_price 資料\nCOPY public.fm_stock_price FROM stdin WITH CSV;\n`);
        const csvData = fs.readFileSync('/tmp/fm_stock_price_data.csv');
        fs.appendFileSync('/tmp/slim_db.sql', csvData);
        // 重要：\. 必須在獨立的一行
        fs.appendFileSync('/tmp/slim_db.sql', `\n\\.\n`);

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
