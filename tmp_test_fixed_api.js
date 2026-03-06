const { pool } = require('./server/db');

// Replicate exact logic from realtime_query.js after fix
async function testAPI() {
    const symbol = '2330';
    const date = null; // auto-detect

    let targetDate = date;
    if (!targetDate) {
        const dateRes = await pool.query(`
            SELECT TO_CHAR(MAX(trade_time), 'YYYY-MM-DD') as max_date 
            FROM realtime_ticks 
            WHERE symbol = $1
        `, [symbol]);
        targetDate = dateRes.rows[0]?.max_date;
    }
    console.log("Target date:", targetDate);

    const sql = `
        SELECT 
            TO_CHAR(t.trade_time, 'HH24:MI:SS') as time_str,
            t.price, t.previous_close
        FROM realtime_ticks t
        WHERE t.symbol = $1 
          AND DATE(t.trade_time) = $2::date
        ORDER BY t.trade_time ASC
        LIMIT 5
    `;
    const result = await pool.query(sql, [symbol, targetDate]);
    console.log(`Found ${result.rows.length} rows for ${symbol} on ${targetDate}`);
    if (result.rows.length > 0) {
        console.log("Sample:", JSON.stringify(result.rows.slice(0, 3), null, 2));
    }
    pool.end();
}
testAPI().catch(e => { console.error(e); pool.end(); });
