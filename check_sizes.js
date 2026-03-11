const { pool } = require('./server/db');

async function main() {
    try {
        const tablesToCheck = [
            'stock_health_scores',
            'fm_total_margin',
            'fm_total_institutional',
            'market_focus_daily',
            'realtime_ticks_2026_03_02',
            'ai_reports'
        ];
        for (const t of tablesToCheck) {
            try {
                const res = await pool.query("SELECT count(*) FROM " + t);
                console.log(t + ": " + res.rows[0].count + " rows");
            } catch(e) { console.log(t + ": error"); }
        }
    } catch(e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
main();
