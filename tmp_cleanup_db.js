const { pool } = require('./server/db');

async function cleanupOldBackups() {
    try {
        console.log("開始清理無用的舊備份資料表...");

        // Drop the large tables
        await pool.query('DROP TABLE IF EXISTS institutional_old_backup;');
        console.log("✅ 已刪除 institutional_old_backup (~2.0 GB)");

        await pool.query('DROP TABLE IF EXISTS daily_prices_old_backup;');
        console.log("✅ 已刪除 daily_prices_old_backup (~187 MB)");

        console.log("\n清理完成。重新計算資料庫總大小...");

        const totalQuery = `
            SELECT pg_size_pretty(pg_database_size(current_database())) as "資料庫總大小";
        `;
        const totalRes = await pool.query(totalQuery);
        console.log("目前的資料庫總大小:", totalRes.rows[0]["資料庫總大小"]);

    } catch (e) {
        console.error("清理失敗:", e);
    } finally {
        pool.end();
    }
}

cleanupOldBackups();
