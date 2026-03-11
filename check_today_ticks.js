const { query } = require('./server/db');

async function checkTicks() {
    try {
        console.log('--- Checking 2330 Ticks for Today (March 10) ---');
        const res = await query(`
            SELECT price, TO_CHAR(trade_time, 'HH24:MI:SS') as time_str 
            FROM realtime_ticks 
            WHERE symbol = '2330' 
            AND (trade_time AT TIME ZONE 'Asia/Taipei')::date = '2026-03-10'::date
            ORDER BY trade_time ASC LIMIT 10
        `);
        console.table(res.rows);

        const last = await query(`
            SELECT price, TO_CHAR(trade_time, 'HH24:MI:SS') as time_str 
            FROM realtime_ticks 
            WHERE symbol = '2330' 
            AND (trade_time AT TIME ZONE 'Asia/Taipei')::date = '2026-03-10'::date
            ORDER BY trade_time DESC LIMIT 1
        `);
        console.log('Final Tick Price Today:', last.rows[0]?.price);

    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkTicks();
