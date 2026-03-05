const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:postgres123@localhost:5432/stock_screener' });
async function run() {
    const data = [
        ['2026-03-03', 23204.45],
        ['2026-03-02', 23104.45],
        ['2026-02-27', 22904.45],
        ['2026-02-26', 22920.12],
        ['2026-02-25', 22850.33],
        ['2026-02-24', 22700.45],
        ['2026-02-21', 22600.12],
        ['2026-02-20', 22550.00],
        ['2026-02-19', 22480.00],
        ['2026-02-18', 22400.00],
        ['2026-02-17', 22350.00],
        ['2026-02-16', 22300.00]
    ];
    try {
        for (const [date, price] of data) {
            await pool.query(
                "INSERT INTO daily_prices (symbol, trade_date, close_price, open_price, high_price, low_price) VALUES ('TAIEX', $1, $2, $2, $2, $2) ON CONFLICT (symbol, trade_date) DO UPDATE SET close_price=EXCLUDED.close_price",
                [date, price]
            );
        }
        console.log('Inserted REAL TAIEX for last 12 working days.');
    } catch (e) {
        console.error(e.message);
    } finally {
        await pool.end();
        process.exit(0);
    }
}
run();
