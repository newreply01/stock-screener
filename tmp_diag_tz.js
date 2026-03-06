const { pool } = require('./server/db');

async function diagTz() {
    try {
        // Check PostgreSQL timezone setting
        const r1 = await pool.query(`SHOW timezone;`);
        console.log("PG timezone:", r1.rows[0]);

        // Test AT TIME ZONE conversion
        const r2 = await pool.query(`SELECT NOW() as now_utc, NOW() AT TIME ZONE 'Asia/Taipei' as now_tpe`);
        console.log("Now UTC:", r2.rows[0].now_utc);
        console.log("Now Taipei:", r2.rows[0].now_tpe);

        // Check if timezone data is available
        const r3 = await pool.query(`SELECT * FROM pg_timezone_names WHERE name = 'Asia/Taipei';`);
        console.log("Asia/Taipei TZ available:", r3.rowCount);

        // Try with interval instead
        const r4 = await pool.query(`SELECT NOW() + INTERVAL '8 hours' as now_plus8;`);
        console.log("Now+8h:", r4.rows[0].now_plus8);

        // Check the actual trade_time values and what date they map to
        const r5 = await pool.query(`
            SELECT trade_time,
                   trade_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Taipei' as tpe_v2,
                   trade_time + INTERVAL '8 hours' as tpe_v3
            FROM realtime_ticks WHERE symbol='2330' ORDER BY trade_time DESC LIMIT 3
        `);
        console.log("Tick conversions:", JSON.stringify(r5.rows, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
diagTz();
