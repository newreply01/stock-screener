const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5432 });

async function test() {
    const symbol = '2330';
    try {
        console.log('--- 1. Testing Price Query ---');
        const priceRes = await pool.query(`
            WITH recent_prices AS (
                SELECT high_price, low_price, close_price, trade_date
                FROM daily_prices
                WHERE symbol = $1
                ORDER BY trade_date DESC
                LIMIT 20
            )
            SELECT 
                (SELECT close_price FROM recent_prices LIMIT 1) as latest_price,
                (SELECT MAX(high_price) FROM recent_prices) as high_20,
                (SELECT MIN(low_price) FROM recent_prices) as low_20,
                (SELECT TO_CHAR(trade_date, 'YYYY-MM-DD') FROM recent_prices LIMIT 1) as latest_date
        `, [symbol]);
        console.log('Price Query OK:', priceRes.rows[0]);

        console.log('--- 2. Testing Health Query ---');
        const healthRes = await pool.query(`SELECT score FROM health_scores WHERE symbol = $1`, [symbol]);
        console.log('Health Query OK:', healthRes.rows[0]);

        console.log('--- 3. Testing Indicators Query ---');
        const techRes = await pool.query(`
            SELECT rsi_14, ma_20, macd_hist
            FROM indicators
            WHERE symbol = $1
            ORDER BY trade_date DESC
            LIMIT 1
        `, [symbol]);
        console.log('Tech Query OK:', techRes.rows[0]);

    } catch (err) {
        console.error('❌ SQL ERROR:', err.stack);
    } finally {
        await pool.end();
    }
}
test();
