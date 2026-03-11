const { query } = require('./server/db');

async function check() {
    try {
        const instRes = await query("SELECT trade_date, COUNT(*) FROM institutional GROUP BY trade_date ORDER BY trade_date DESC LIMIT 5");
        console.log("institutional count per day:");
        console.table(instRes.rows);

        const marketStats = await query("SELECT trade_date, COUNT(*) FROM daily_prices GROUP BY trade_date HAVING COUNT(*) > 500 ORDER BY trade_date DESC LIMIT 5");
        console.log("daily_prices count per day:");
        console.table(marketStats.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
check();
