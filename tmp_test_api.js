const { pool } = require('./server/db');

async function test() {
    try {
        const symbol = '2330';
        console.log(`Testing symbol: ${symbol}`);

        let targetDateRes = await pool.query(`
            SELECT TO_CHAR(MAX(trade_time AT TIME ZONE 'Asia/Taipei'), 'YYYY-MM-DD') as max_date 
            FROM realtime_ticks 
            WHERE symbol = $1
        `, [symbol]);

        let targetDate = targetDateRes.rows[0]?.max_date;
        console.log(`Max Date from DB: ${targetDate}`);

        if (!targetDate) {
            console.log('No data found for symbol');
            return;
        }

        const sql = `
            SELECT 
                t.symbol, s.name, s.industry,
                TO_CHAR(t.trade_time AT TIME ZONE 'Asia/Taipei', 'HH24:MI:SS') as time_str,
                t.trade_time, 
                t.price, t.open_price, t.high_price, t.low_price, 
                t.volume, t.trade_volume, 
                t.buy_intensity, t.sell_intensity, t.five_levels,
                (SELECT close_price FROM daily_prices dp WHERE dp.symbol = t.symbol AND dp.trade_date < DATE($2) ORDER BY dp.trade_date DESC LIMIT 1) as previous_close
            FROM realtime_ticks t
            LEFT JOIN stocks s ON t.symbol = s.symbol
            WHERE t.symbol = $1 
              AND TO_CHAR(t.trade_time AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD') = $2
            ORDER BY t.trade_time ASC
        `;
        const result = await pool.query(sql, [symbol, targetDate]);
        console.log(`Found ${result.rows.length} rows for ${symbol} on ${targetDate}`);
        if (result.rows.length > 0) {
            console.log('Sample row:', result.rows[0].time_str, result.rows[0].price);
        }
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
test();
