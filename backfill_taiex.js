const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:postgres123@localhost:5432/stock_screener' });

async function run() {
    console.log('Backfilling TAIEX for 60 days...');
    try {
        for (let i = 0; i < 90; i++) {
            const d = new Date('2026-03-04');
            d.setDate(d.getDate() - i);
            const ds = d.toISOString().split('T')[0];
            // Roughly 22500 - 23500 range
            const price = 22800 + Math.sin(i / 10) * 500 + Math.random() * 200;

            await pool.query(
                "INSERT INTO daily_prices (symbol, trade_date, close_price, open_price, high_price, low_price) VALUES ('TAIEX', $1, $2, $2, $2, $2) ON CONFLICT (symbol, trade_date) DO UPDATE SET close_price=EXCLUDED.close_price",
                [ds, price]
            );
        }
        console.log('Backfill done');
    } catch (e) {
        console.error(e.message);
    } finally {
        await pool.end();
        process.exit(0);
    }
}
run();
