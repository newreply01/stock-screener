const { query } = require('./server/db');

async function check() {
    try {
        const instRes = await query("SELECT COUNT(*) FROM fm_institutional");
        console.log("fm_institutional count:", instRes.rows[0].count);

        const instRecent = await query("SELECT date, name, buy, sell FROM fm_institutional ORDER BY date DESC LIMIT 5");
        console.log("Latest fm_institutional:", instRecent.rows);

        const marginRes = await query("SELECT COUNT(*) FROM fm_total_margin");
        console.log("fm_total_margin count:", marginRes.rows[0].count);

        const dpCount = await query("SELECT COUNT(*) FROM daily_prices WHERE symbol='TAIEX'");
        console.log("TAIEX count in daily_prices:", dpCount.rows[0].count);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
check();
