const { pool } = require('./server/db');

async function reportHistoricalTicks() {
    try {
        // Overall summary
        const r1 = await pool.query(`
            SELECT 
                COUNT(*) as total_ticks,
                COUNT(DISTINCT symbol) as total_symbols,
                MIN(trade_time)::date as earliest_date,
                MAX(trade_time)::date as latest_date
            FROM realtime_ticks
        `);
        console.log("=== Overall Summary ===");
        console.log(JSON.stringify(r1.rows[0], null, 2));

        // By date breakdown (top 20 most recent)
        const r2 = await pool.query(`
            SELECT 
                DATE(trade_time) as date,
                COUNT(*) as ticks,
                COUNT(DISTINCT symbol) as symbols
            FROM realtime_ticks
            GROUP BY DATE(trade_time)
            ORDER BY date DESC
            LIMIT 20
        `);
        console.log("\n=== Daily Breakdown (most recent 20 days) ===");
        r2.rows.forEach(r => console.log(`  ${r.date}  ticks: ${r.ticks}  symbols: ${r.symbols}`));

        // Check if there's real historical data (before this week)
        const r3 = await pool.query(`
            SELECT COUNT(*) as historical_ticks
            FROM realtime_ticks
            WHERE DATE(trade_time) < CURRENT_DATE - INTERVAL '7 days'
        `);
        console.log("\n=== Ticks older than 7 days ===");
        console.log(`Historical (>7 days old): ${r3.rows[0].historical_ticks}`);

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
reportHistoricalTicks();
