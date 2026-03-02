const { query } = require('./server/db');

async function test() {
    try {
        const res = await query("SELECT trade_date, TO_CHAR(trade_date, 'YYYY-MM-DD') as to_char_date FROM daily_prices ORDER BY trade_date DESC LIMIT 5");
        console.table(res.rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
test();
