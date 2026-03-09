// export_slim_db.js (Stable Version)
const { execSync } = require('child_process');
const { pool } = require('./server/db');
const fs = require('fs');

const pgHost = process.env.DB_HOST || '127.0.0.1';
const pgPort = process.env.DB_PORT || '5432';
const pgUser = process.env.DB_USER || 'postgres';
const pgPass = process.env.DB_PASSWORD || 'postgres123';
const pgDb = process.env.DB_NAME || 'stock_screener';
const env = { ...process.env, PGPASSWORD: pgPass };

const OUTPUT_FILE = '/home/xg/stock-screener/slim_db.sql';
const TMP_DATA_DIR = '/tmp/slim_data';

async function exportSlimDB() {
    console.log("🚀 開始產生「穩定性優先」瘦身版資料庫匯出檔 (slim_db.sql)...");
    if (!fs.existsSync(TMP_DATA_DIR)) fs.mkdirSync(TMP_DATA_DIR);

    try {
        const manualTables = [
            'daily_prices_2025',
            'daily_prices_2026',
            'institutional_2025',
            'institutional_2026',
            'fm_stock_price'
        ];

        // 1. 匯出結構與除大型表外的數據
        console.log("📦 1/2 匯出結構與基礎數據...");
        const excludeFlags = manualTables.map(t => `--exclude-table-data="public.${t}"`).join(' ');
        // 使用 --clean --if-exists 由 pg_dump 生成正確的 DROP 順序
        const dumpCmd = `pg_dump -h ${pgHost} -p ${pgPort} -U ${pgUser} -d ${pgDb} -O -x --clean --if-exists --no-security-labels --no-privileges --no-comments ${excludeFlags} -f ${OUTPUT_FILE}`;
        execSync(dumpCmd, { stdio: 'inherit', env });

        // 2. 追加 Header (優化導入)
        const header = `-- Stock Screener Slim DB\n` +
                       `SET statement_timeout = 0;\n` +
                       `SET client_encoding = 'UTF8';\n` +
                       `SET session_replication_role = 'replica';\n\n`;
        const currentSql = fs.readFileSync(OUTPUT_FILE, 'utf8');
        fs.writeFileSync(OUTPUT_FILE, header + currentSql);

        // 3. 追加手動數據
        console.log("📦 2/2 追加 2025-2026 數據...");
        const filters = {
            'daily_prices_2025': "WHERE length(symbol) < 6",
            'daily_prices_2026': "WHERE length(symbol) < 6",
            'institutional_2025': "WHERE length(symbol) < 6",
            'institutional_2026': "WHERE length(symbol) < 6",
            'fm_stock_price': "WHERE date >= '2025-01-01'"
        };

        for (const tableName of manualTables) {
            console.log(`   - 追加: ${tableName}`);
            const filterClause = filters[tableName] || "";
            const csvFile = `${TMP_DATA_DIR}/${tableName}.csv`;
            
            const psqlCopy = `psql -h ${pgHost} -p ${pgPort} -U ${pgUser} -d ${pgDb} -c \"COPY (SELECT * FROM \\\"${tableName}\\\" ${filterClause}) TO STDOUT WITH CSV\" > ${csvFile}`;
            execSync(psqlCopy, { env });

            fs.appendFileSync(OUTPUT_FILE, `\n-- Manual Data for ${tableName}\nCOPY public."${tableName}" FROM stdin WITH CSV;\n`);
            const data = fs.readFileSync(csvFile);
            fs.appendFileSync(OUTPUT_FILE, data);
            if (data.length > 0 && data[data.length - 1] !== 10) fs.appendFileSync(OUTPUT_FILE, "\n");
            fs.appendFileSync(OUTPUT_FILE, "\\.\n");
        }

        fs.appendFileSync(OUTPUT_FILE, `\nSET session_replication_role = 'origin';\n`);
        const stats = fs.statSync(OUTPUT_FILE);
        console.log(`✅ 匯出完成！檔案：${OUTPUT_FILE}`);
        console.log(`📊 最終檔案大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    } catch (e) {
        console.error("❌ 匯出失敗:", e.message);
    } finally {
        pool.end();
    }
}

exportSlimDB();
