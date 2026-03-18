const { pool } = require('../db');

async function analyze() {
    console.log('--- Starting Score Performance Analysis ---');
    try {
        // 1. Get available calc_dates from health scores
        const dateRes = await pool.query(`
            SELECT DISTINCT calc_date 
            FROM stock_health_scores 
            ORDER BY calc_date DESC 
            LIMIT 20
        `);
        const dates = dateRes.rows.map(r => r.calc_date.toISOString().split('T')[0]);
        console.log('Available calculation dates:', dates);

        if (dates.length < 2) {
            console.log('Not enough historical data for comparison.');
            return;
        }

        const results = [];

        // 2. Compare T with T+1 for each adjacent pair of dates
        for (let i = 0; i < dates.length - 1; i++) {
            const currDate = dates[i+1]; // The day we "recommended" (T)
            const nextDate = dates[i];   // The day we check performance (T+1)
            
            console.log(`Analyzing recommendations from ${currDate} vs performance on ${nextDate}...`);

            const perfRes = await pool.query(`
                WITH prev AS (
                    SELECT symbol, close_price as price_prev, smart_rating, grade
                    FROM stock_health_scores
                    WHERE calc_date = $1
                ),
                curr AS (
                    SELECT symbol, close_price as price_curr
                    FROM stock_health_scores
                    WHERE calc_date = $2
                )
                SELECT 
                    prev.smart_rating,
                    prev.grade,
                    COUNT(*) as count,
                    ROUND(AVG((curr.price_curr - prev.price_prev) / prev.price_prev * 100), 2) as avg_return_pct,
                    ROUND(COUNT(CASE WHEN curr.price_curr > prev.price_prev THEN 1 END) * 100.0 / COUNT(*), 2) as win_rate_pct
                FROM prev
                JOIN curr ON prev.symbol = curr.symbol
                WHERE prev.price_prev > 0
                GROUP BY prev.smart_rating, prev.grade
            `, [currDate, nextDate]);

            results.push({
                recommend_date: currDate,
                test_date: nextDate,
                stats: perfRes.rows
            });
        }

        console.log('\n--- Summary of Results ---');
        results.forEach(day => {
            console.log(`\nDate: ${day.recommend_date} -> ${day.test_date}`);
            day.stats.forEach(s => {
                console.log(`  [${s.smart_rating}] Count: ${s.count}, Avg Return: ${s.avg_return_pct}%, Win Rate: ${s.win_rate_pct}%`);
            });
        });

        // Optional: Save to a summary table or just return for API
        // For now, we will compute this on-the-fly in the API but maybe cache it.

    } catch (e) {
        console.error('Analysis failed:', e);
    } finally {
        await pool.end();
    }
}

analyze();
