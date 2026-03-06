const { pool } = require('./server/db');

async function backfillPreviousClose() {
    try {
        // Get the correct previous_close from TWSE data (from newly captured ticks)
        const r1 = await pool.query(`
            SELECT previous_close FROM realtime_ticks 
            WHERE symbol='2330' AND previous_close IS NOT NULL
            ORDER BY trade_time DESC LIMIT 1
        `);
        const correctPrevClose = r1.rows[0]?.previous_close;
        if (!correctPrevClose) {
            console.log("No non-null previous_close found!");
            return;
        }
        console.log("Correct previous_close to use:", correctPrevClose);

        // Update all null previous_close rows for today
        const r2 = await pool.query(`
            UPDATE realtime_ticks 
            SET previous_close = $1
            WHERE previous_close IS NULL 
              AND DATE(trade_time) = CURRENT_DATE
        `, [correctPrevClose]);
        console.log(`Updated ${r2.rowCount} rows with previous_close = ${correctPrevClose}`);

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
backfillPreviousClose();
