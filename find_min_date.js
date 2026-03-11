const { query } = require('./server/db');

async function findMinDate() {
    try {
        const res = await query("SELECT MIN(trade_date) as min_date FROM daily_prices");
        console.log(res.rows[0].min_date);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

findMinDate();
