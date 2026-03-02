const db = require('./db');
async function check() {
    try {
        const stocks = await db.query("SELECT market, COUNT(*) FROM stocks GROUP BY market");
        console.log("Stocks Table:", stocks.rows);
        const prices = await db.query("SELECT s.market, COUNT(p.symbol) FROM daily_prices p JOIN stocks s ON p.symbol = s.symbol GROUP BY s.market");
        console.log("Prices Table:", prices.rows);
    } catch (e) { console.error(e); }
    process.exit();
}
check();
