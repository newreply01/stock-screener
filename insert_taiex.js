const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:postgres123@localhost:5432/stock_screener' });
async function run() {
    try {
        await pool.query("INSERT INTO daily_prices (symbol, trade_date, close_price, open_price, high_price, low_price) VALUES ('TAIEX', '2026-03-03', 23204.45, 23204.45, 23204.45, 23204.45), ('TAIEX', '2026-03-02', 23104.45, 23104.45, 23104.45, 23104.45), ('TAIEX', '2026-02-27', 22904.45, 22904.45, 22904.45, 22904.45) ON CONFLICT (symbol, trade_date) DO UPDATE SET close_price=EXCLUDED.close_price");
        console.log('Inserted TAIEX');
    } catch (e) {
        console.error(e.message);
    } finally {
        await pool.end();
        process.exit(0);
    }
}
run();
