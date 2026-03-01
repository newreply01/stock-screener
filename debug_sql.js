const { query } = require('./server/db');

async function test() {
    try {
        const actualDateResult = await query('SELECT MAX(trade_date) as actual_date FROM daily_prices');
        const actualDate = actualDateResult.rows[0].actual_date;
        console.log('Actual Date:', actualDate);

        // Test without filter
        const res1 = await query('SELECT count(*) from daily_prices where trade_date = \', [actualDate]);
        console.log('Total for date:', res1.rows[0].count);

        // Test with price_min = 10
        const price_min = 10;
        const res2 = await query('SELECT count(*) from daily_prices where trade_date = \ AND close_price >= \', [actualDate, price_min]);
        console.log('Total with price_min=10:', res2.rows[0].count);

        // Test with pe_min = 10
        const pe_min = 10;
        const res3 = await query(            SELECT count(*) 
            FROM stocks s
            JOIN daily_prices p ON s.symbol = p.symbol
            LEFT JOIN LATERAL (
                SELECT pe_ratio
                FROM fundamentals f_sub
                WHERE f_sub.symbol = s.symbol AND f_sub.trade_date <=                 ORDER BY f_sub.trade_date DESC
                LIMIT 1
            ) f ON true
            WHERE p.trade_date = \ AND f.pe_ratio >=         \, [actualDate, pe_min]);
        console.log('Total with pe_min=10:', res3.rows[0].count);

        // Check some data
        const res4 = await query('SELECT symbol, close_price FROM daily_prices WHERE trade_date = \ LIMIT 5', [actualDate]);
        console.log('Sample Data:', res4.rows);

    } catch (err) {
        console.error('SQL Error:', err.message);
    }
    process.exit();
}

test();
