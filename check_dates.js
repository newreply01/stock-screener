const { query } = require('./server/db');

async function check() {
    try {
        console.log("=== daily_prices top 5 dates ===");
        const dp = await query("SELECT trade_date, COUNT(*) FROM daily_prices GROUP BY trade_date ORDER BY trade_date DESC LIMIT 5");
        console.table(dp.rows);

        console.log("=== institutional top 5 dates ===");
        const inst = await query("SELECT trade_date, COUNT(*) FROM institutional GROUP BY trade_date ORDER BY trade_date DESC LIMIT 5");
        console.table(inst.rows);

        const marketDate = await query('SELECT MAX(trade_date) as max_date FROM daily_prices');
        console.log("MAX(trade_date) original Object:", marketDate.rows[0].max_date);
        console.log("MAX(trade_date) String:", String(marketDate.rows[0].max_date));
        console.log("MAX(trade_date) format:", Object.prototype.toString.call(marketDate.rows[0].max_date));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();
