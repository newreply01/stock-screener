
// export_slim_db.js
// 這支腳本會在本機產生一個 slim_db.sql，包含所有結構(Schema)，
// 但大型資料表只保留最近一年的資料，且排除所有權證相關資料。

const { execSync } = require('child_process');
const { pool } = require('./server/db');
const fs = require('fs');

const pgHost = process.env.DB_HOST || '127.0.0.1';
const pgPort = process.env.DB_PORT || '5432';
const pgUser = process.env.DB_USER || 'postgres';
const pgPass = process.env.DB_PASSWORD || 'postgres123';
const pgDb = process.env.DB_NAME || 'stock_screener';
const env = { ...process.env, PGPASSWORD: pgPass };

const OUTPUT_FILE = '/tmp/slim_db.sql';

async function exportSlimDB() {
    console.log("🚀 開始產生「排除權證」瘦身版資料庫匯出檔 (slim_db.sql)...");

    // 1. 取得所有資料表清單
    const res = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
    const allTables = res.rows.map(r => r.tablename);

    // 2. 決定哪些表要排除資料 (Keep Schema, Exclude Data)
    // 這些表我們之後會手動補充「過濾後」的資料
    // NOTE: 'stocks' 從此清單移出，由 pg_dump 直接處理，可解決大部分 FK 問題
    const manualTables = [
        'daily_prices_2025',
        'daily_prices_2026',
        'institutional_2025',
        'institutional_2026',
        'fm_stock_price'
    ];

    const excludeDataFlags = [];
    allTables.forEach(t => {
        // 完全排除 (結構+資料)：舊年份或暫存表
        if (t.includes('_old_backup') || 
            t.match(/^institutional_(2021|2022|2023|2024)$/) || 
            t.match(/^daily_prices_(2021|2022|2023|2024)$/) || 
            t.startsWith('realtime_ticks_')) {
            excludeDataFlags.push(`-T "${t}"`);
        }
        // 只排除資料 (保留結構)：我們在 manualTables 中處理的表
        else if (manualTables.includes(t)) {
            excludeDataFlags.push(`--exclude-table-data="${t}"`);
        }
    });

    try {
        // Step 1: 匯出 Schema + 預設資料
        console.log("📦 1/3 匯出全表結構與基礎數據 (已排除大型區隔表資料)...");
        const excludeString = excludeDataFlags.join(' ');
        const dumpCmd = `pg_dump -h ${pgHost} -p ${pgPort} -U ${pgUser} -d ${pgDb} -O -x --no-security-labels --no-privileges --no-comments ${excludeString} -f ${OUTPUT_FILE}`;
        execSync(dumpCmd, { stdio: 'inherit', env });

        // Step 1.5: 插入優化與清理區塊
        console.log("🛠️  插入優化與 DROP TABLE 區塊...");
        const originalContent = fs.readFileSync(OUTPUT_FILE, 'utf8');
        const dropStrings = allTables
            .filter(t => !t.startsWith('realtime_ticks_'))
            .map(t => `DROP TABLE IF EXISTS public."${t}" CASCADE;`)
            .join('\n');
        
        const header = `-- Stock Screener Slim DB\n` +
                       `SET statement_timeout = 0;\n` +
                       `SET lock_timeout = 0;\n` +
                       `SET client_encoding = 'UTF8';\n` +
                       `SET standard_conforming_strings = on;\n` +
                       `SET check_function_bodies = false;\n` +
                       `SET client_min_messages = warning;\n` +
                       `SET session_replication_role = 'replica';\n\n` +
                       `-- Cleanup\n${dropStrings}\n\n`;
        
        fs.writeFileSync(OUTPUT_FILE, header + originalContent);

        // Step 2: 手動追加過濾後的資料
        console.log("📦 2/3 正在追加過濾後的區隔表資料...");
        
        const filters = {
            'daily_prices_2025': "WHERE length(symbol) < 6",
            'daily_prices_2026': "WHERE length(symbol) < 6",
            'institutional_2025': "WHERE length(symbol) < 6",
            'institutional_2026': "WHERE length(symbol) < 6",
            'fm_stock_price': "WHERE date >= '2025-01-01'"
        };

        for (const tableName of manualTables) {
            if (!allTables.includes(tableName)) continue;
            
            console.log(`   - 處理表: ${tableName}`);
            const filterClause = filters[tableName] || "";
            // 注意：這裡使用符號表過濾以確保權證被排除 (除了 fm_stock_price)
            const copySql = `COPY (SELECT * FROM "${tableName}" ${filterClause}) TO STDOUT WITH CSV;\n`;
            const sqlFile = `/tmp/${tableName}_copy.sql`;
            const csvFile = `/tmp/${tableName}_data.csv`;
            
            fs.writeFileSync(sqlFile, copySql);
            
            const psqlCmd = `psql -h ${pgHost} -p ${pgPort} -U ${pgUser} -d ${pgDb} -f ${sqlFile} > ${csvFile}`;
            execSync(psqlCmd, { env });

            fs.appendFileSync(OUTPUT_FILE, `\n-- Data for ${tableName} (Slimmed)\nCOPY public."${tableName}" FROM stdin WITH CSV;\n`);
            if (fs.existsSync(csvFile)) {
                const csvData = fs.readFileSync(csvFile);
                fs.appendFileSync(OUTPUT_FILE, csvData);
                fs.appendFileSync(OUTPUT_FILE, `\\.\n`);
            }
        }

        fs.appendFileSync(OUTPUT_FILE, `\nSET session_replication_role = 'origin';\n`);
        console.log(`✅ 匯出完成！檔案：${OUTPUT_FILE}`);
        const stats = fs.statSync(OUTPUT_FILE);
        console.log(`📊 最終檔案大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    } catch (e) {
        console.error("❌ 匯出失敗:", e.message);
    } finally {
        pool.end();
    }
}

exportSlimDB();
