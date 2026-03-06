const { pool } = require('./server/db');

async function getDBStats() {
    try {
        const query = `
            SELECT
                relname AS "表名",
                n_live_tup AS "估計筆數",
                pg_size_pretty(pg_total_relation_size(relid)) AS "總空間 (含索引)",
                pg_size_pretty(pg_relation_size(relid)) AS "資料空間",
                pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS "索引空間"
            FROM
                pg_stat_user_tables
            ORDER BY
                pg_total_relation_size(relid) DESC;
        `;
        const res = await pool.query(query);
        console.table(res.rows);

        const totalQuery = `
            SELECT pg_size_pretty(pg_database_size(current_database())) as "資料庫總大小";
        `;
        const totalRes = await pool.query(totalQuery);
        console.log("資料庫總大小:", totalRes.rows[0]["資料庫總大小"]);

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
getDBStats();
