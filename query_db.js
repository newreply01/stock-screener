const { query } = require('./server/db');

async function check() {
    try {
        const marginRes = await query("SELECT date, name FROM fm_total_margin ORDER BY date DESC LIMIT 5");
        console.log("Latest fm_total_margin:");
        console.table(marginRes.rows);

        const taiexRes = await query("SELECT trade_date, close_price FROM daily_prices WHERE symbol='TAIEX' ORDER BY trade_date DESC LIMIT 5");
        console.log("Latest TAIEX daily_prices:");
        console.table(taiexRes.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
check();
