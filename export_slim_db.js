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
        const SYMBOL_FILTER = "(SELECT symbol FROM stocks WHERE industry IS NOT NULL AND industry NOT LIKE '%權證%' AND industry NOT LIKE '%牛證%' AND industry NOT LIKE '%熊證%')";

        const manualTables = [
            'stocks',
            'daily_prices_2025',
            'daily_prices_2026',
            'institutional_2025',
            'institutional_2026',
            'fm_stock_price',
            'realtime_ticks',
            'snapshot_last_close',
            'fundamentals',
            'fm_financial_statements',
            'fm_balance_sheet',
            'fm_cash_flows',
            'monthly_revenue',
            'dividend_policy',
            'fm_holding_shares_per',
            'user_holdings',
            'watchlist_items',
            'indicators',
            'fm_broker_trading',
            'stock_health_scores',
            'ai_reports',
            'stock_daily_analysis_results'
        ];

        const ptRes = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'realtime_ticks_%'");
        const partitionTables = ptRes.rows.map(r => r.table_name);

        const noDataTables = [
            'realtime_ticks_history',
            'fm_sync_progress',
            'audit_logs',
            'institutional_2024',
            'institutional_2023',
            'institutional_2022',
            'institutional_2021',
            'daily_prices_2024',
            'daily_prices_2023',
            'daily_prices_2022',
            'daily_prices_2021',
            'broker_trades',
            'realtime_statistics',
            ...partitionTables
        ];

        // 1. 匯出結構與除大型表外的數據
        console.log("📦 1/2 匯出結構與基礎數據...");
        const allExcluded = [...manualTables, ...noDataTables];
        const excludeFlags = allExcluded.map(t => `--exclude-table-data="public.${t}"`).join(' ');
        
        // 使用 --clean --if-exists 由 pg_dump 生成正確的 DROP 順序
        const dumpCmd = `pg_dump -h ${pgHost} -p ${pgPort} -U ${pgUser} -d ${pgDb} -O -x --clean --if-exists --no-security-labels --no-privileges --no-comments ${excludeFlags} -f ${OUTPUT_FILE}`;
        execSync(dumpCmd, { stdio: 'inherit', env });

        // 2. 追加 Header (使用串流避免記憶體溢出)
        console.log("📝 1.5/2 加入自定義 Header...");
        const header = `-- Stock Screener Slim DB (Optimized for 500MB Limit & 2025+ Data)\n` +
                       `SET statement_timeout = 0;\n` +
                       `SET client_encoding = 'UTF8';\n` +
                       `SET session_replication_role = 'replica';\n\n`;
        
        const TEMP_SQL = OUTPUT_FILE + '.tmp';
        fs.writeFileSync(TEMP_SQL, header);
        execSync(`cat ${OUTPUT_FILE} >> ${TEMP_SQL}`, { env });
        fs.renameSync(TEMP_SQL, OUTPUT_FILE);

        // 3. 追加手動數據 (使用智慧過濾)
        console.log("📦 2/2 追加過濾後的標的與歷史數據...");
        
        // 更健全的股票過濾：包含熱門股、ETF，但不包含權證
        const STOCK_FILTER = "WHERE (industry IS NULL OR (industry NOT LIKE '%權證%' AND industry NOT LIKE '%牛證%' AND industry NOT LIKE '%熊證%'))";
        const SYMBOL_FILTER_INNER = "(SELECT symbol FROM stocks " + STOCK_FILTER + ")";

        const filters = {
            'stocks': STOCK_FILTER,
            'daily_prices_2025': `WHERE symbol IN ${SYMBOL_FILTER_INNER}`,
            'daily_prices_2026': `WHERE symbol IN ${SYMBOL_FILTER_INNER}`,
            'institutional_2025': `WHERE symbol IN ${SYMBOL_FILTER_INNER} AND trade_date >= (CURRENT_DATE - INTERVAL '30 days')`,
            'institutional_2026': `WHERE symbol IN ${SYMBOL_FILTER_INNER}`,
            'fm_stock_price': `WHERE stock_id IN ${SYMBOL_FILTER_INNER} AND date >= '2025-01-01'`,
            // 即時資料：僅保留最新一天且進行 1 分鐘抽樣 (減少數據量)
            'realtime_ticks': `WHERE symbol IN ${SYMBOL_FILTER_INNER} AND trade_time::date = (SELECT MAX(trade_time::date) FROM realtime_ticks) AND EXTRACT(SECOND FROM trade_time) = 0`,
            'snapshot_last_close': `WHERE symbol IN ${SYMBOL_FILTER_INNER}`,
            'fundamentals': `WHERE symbol IN ${SYMBOL_FILTER_INNER} AND trade_date >= '2025-01-01'`,
            'fm_financial_statements': `WHERE stock_id IN ${SYMBOL_FILTER_INNER} AND date >= '2024-01-01'`, // 財報需往前抓一年算 YoY
            'fm_balance_sheet': `WHERE stock_id IN ${SYMBOL_FILTER_INNER} AND date >= '2024-01-01'`,
            'fm_cash_flows': `WHERE stock_id IN ${SYMBOL_FILTER_INNER} AND date >= '2024-01-01'`,
            'monthly_revenue': `WHERE symbol IN ${SYMBOL_FILTER_INNER} AND revenue_year >= 2024`,
            'dividend_policy': `WHERE symbol IN ${SYMBOL_FILTER_INNER} AND year >= 2020`,
            'fm_holding_shares_per': `WHERE stock_id IN ${SYMBOL_FILTER_INNER} AND date >= '2025-01-01'`,
            'user_holdings': `WHERE symbol IN ${SYMBOL_FILTER_INNER}`,
            'watchlist_items': `WHERE symbol IN ${SYMBOL_FILTER_INNER}`,
            'indicators': `WHERE symbol IN ${SYMBOL_FILTER_INNER} AND trade_date >= '2025-01-01'`,
            'fm_broker_trading': `WHERE stock_id IN ${SYMBOL_FILTER_INNER} AND date >= (CURRENT_DATE - INTERVAL '15 days')`,
            'stock_health_scores': `WHERE symbol IN ${SYMBOL_FILTER_INNER}`,
            'ai_reports': `WHERE symbol IN ${SYMBOL_FILTER_INNER}`,
            'stock_daily_analysis_results': `WHERE symbol IN ${SYMBOL_FILTER_INNER}`
        };

        for (const tableName of manualTables) {
            console.log(`   - 處理並追加: ${tableName}`);
            const filterClause = filters[tableName] || "";
            const csvFile = `${TMP_DATA_DIR}/${tableName}.csv`;
            
            // 使用正確的雙引號處理表名，並動態判斷欄位名稱 (有些是 stock_id)
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
