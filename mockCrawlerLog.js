const { Pool } = require('pg');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URI;
const poolConfig = dbUrl
    ? { connectionString: dbUrl, ssl: false }
    : {
        user: process.env.POSTGRES_USER || 'postgres',
        host: process.env.POSTGRES_HOST || 'localhost',
        database: process.env.POSTGRES_DATABASE || 'stock_screener',
        password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'postgres123',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        ssl: false
    };

const pool = new Pool(poolConfig);

async function mockCrawlerLogs() {
    try {
        const now = new Date();
        const logs = [
            ['realtime_crawler.js', 'RUNNING', '開盤中，持續擷取即時報價...', now],
            ['fetcher.js', 'SUCCESS', '盤後行情抓取完成 (等待下次 15:30 執行)', now],
            ['news_fetcher.js', 'SUCCESS', '新聞更新完成 (等待下次整點執行)', now],
            ['finmind_fetcher.js', 'SUCCESS', '基本面資料更新完成 (等待週六 04:00 執行)', now],
            ['calc_health_scores.js', 'SUCCESS', '健診排行計算完成 (等待下次 16:00 執行)', now]
        ];

        for (const [script, status, message, time] of logs) {
            await pool.query(
                "INSERT INTO system_status (service_name, status, message, check_time) VALUES ($1, $2, $3, $4)",
                [script, status, message, time]
            );
            console.log("Inserted mock log for " + script);
        }
    } catch (err) {
        console.error('Error inserting mock logs:', err.message);
    } finally {
        await pool.end();
    }
}

mockCrawlerLogs();
