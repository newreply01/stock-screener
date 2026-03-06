const { pool } = require('./server/db');

async function diag() {
    try {
        // Raw timestamps
        const r1 = await pool.query(`
            SELECT MAX(trade_time) as max_utc,
                   MAX(trade_time AT TIME ZONE 'Asia/Taipei') as max_tpe,
                   TO_CHAR(MAX(trade_time AT TIME ZONE 'Asia/Taipei'), 'YYYY-MM-DD') as max_date
            FROM realtime_ticks WHERE symbol='2330'
        `);
        console.log("Max tick info:", JSON.stringify(r1.rows[0], null, 2));

        // Count per date (Taipei)
        const r2 = await pool.query(`
            SELECT TO_CHAR(trade_time AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD') as date_tpe,
                   COUNT(*) as cnt
            FROM realtime_ticks WHERE symbol='2330'
            GROUP BY date_tpe
            ORDER BY date_tpe DESC
            LIMIT 5
        `);
        console.log("Ticks by date:", JSON.stringify(r2.rows, null, 2));

        // Test the actual query from realtime_query.js
        const targetDate = r1.rows[0].max_date;
        const r3 = await pool.query(`
            SELECT COUNT(*) as cnt FROM realtime_ticks t
            WHERE t.symbol = '2330'
              AND TO_CHAR(t.trade_time AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD') = $1
        `, [targetDate]);
        console.log(`Rows for target date ${targetDate}:`, r3.rows[0].cnt);

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
diag();
