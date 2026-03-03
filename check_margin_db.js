const { pool } = require('./server/db');

async function run() {
    try {
        console.log("--- Checking Margin Data ---");
        const marginRes = await pool.query("SELECT * FROM fm_total_margin WHERE name = 'MarginPurchaseMoney' ORDER BY date DESC LIMIT 5");
        console.table(marginRes.rows);

        console.log("--- Checking TAIEX Data ---");
        const taiexRes = await pool.query("SELECT * FROM daily_prices WHERE symbol IN ('TAIEX', 'IX0001', '0000', 'TWA00', '發行量加權股價指數') ORDER BY trade_date DESC LIMIT 5");
        console.table(taiexRes.rows);

        console.log("--- See if fm_total_margin has other names ---");
        const namesRes = await pool.query("SELECT DISTINCT name FROM fm_total_margin");
        console.table(namesRes.rows);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
