const { pool } = require('./server/db');

async function diag() {
    try {
        // 1. Check null previous_close count for today
        const r1 = await pool.query(`
            SELECT COUNT(*) as total, 
                   SUM(CASE WHEN previous_close IS NULL THEN 1 ELSE 0 END) as null_count,
                   SUM(CASE WHEN previous_close IS NOT NULL THEN 1 ELSE 0 END) as filled_count
            FROM realtime_ticks 
            WHERE symbol='2330' AND DATE(trade_time) = CURRENT_DATE
        `);
        console.log("Today 2330 ticks:", JSON.stringify(r1.rows[0], null, 2));

        // 2. Show time distribution of today's ticks to see gaps
        const r2 = await pool.query(`
            SELECT TO_CHAR(trade_time, 'HH24:MI:SS') as t, previous_close
            FROM realtime_ticks 
            WHERE symbol='2330' AND DATE(trade_time) = CURRENT_DATE
            ORDER BY trade_time ASC
        `);
        console.log("All today ticks (time, prev_close):");
        r2.rows.forEach(row => console.log(` ${row.t} | ${row.previous_close}`));

        // 3. Get the correct previous_close from recent ticks (non-null)
        const r3 = await pool.query(`
            SELECT previous_close FROM realtime_ticks 
            WHERE symbol='2330' AND previous_close IS NOT NULL
            ORDER BY trade_time DESC LIMIT 1
        `);
        console.log("Latest known previous_close:", r3.rows[0]?.previous_close);

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
diag();
