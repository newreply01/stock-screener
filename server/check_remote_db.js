const { Pool } = require('pg');

// 請將下方的 URL 替換為您的 Zeabur 實際連線字串 (包含密碼的版本)
// 或者您可以將其保留為環境變數，並在執行時傳入
const dbUrl = process.argv[2] || process.env.DATABASE_URL_REMOTE;

if (!dbUrl) {
    console.error('錯誤: 請提供資料庫連線字串作為參數。');
    console.log('範例: node server/check_remote_db.js "postgresql://user:pass@host:port/db"');
    process.exit(1);
}

const dbNameMatch = dbUrl.match(/\/([^/?#]+)([?#]|$)/);
const dbName = dbNameMatch ? dbNameMatch[1] : 'unknown';

async function check(useSSL) {
    const poolConfig = {
        connectionString: dbUrl,
        ssl: useSSL ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 10000,
    };

    const pool = new Pool(poolConfig);

    try {
        console.log(`正在連線至遠端資料庫: ${dbName} (SSL: ${useSSL ? '開' : '關'})...`);

        const queryStr = `
      SELECT table_name, 
             (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::int as row_count
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY row_count DESC;
    `;

        const res = await pool.query(queryStr);
        console.log('--- 遠端數據庫表統計 ---');
        if (res.rows.length === 0) {
            console.log('警告: 沒發現任何表格！資料可能完全沒匯入。');
        } else {
            console.table(res.rows);
        }
        await pool.end();
    } catch (err) {
        if (useSSL && (err.message.includes('SSL') || err.message.includes('protocol'))) {
            console.log('SSL 連線失敗，嘗試不使用 SSL...');
            await pool.end();
            return check(false);
        }
        console.error('連線失敗:', err.message);
        await pool.end();
        process.exit(1);
    }
}

check(true);
