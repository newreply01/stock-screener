const { query } = require('./server/db');

async function main() {
    try {
        // Find latest date for daily_prices
        const dpRes = await query(`
            SELECT trade_date, count(*) as count
            FROM daily_prices
            WHERE symbol ~ '^[0-9]{4}$'
            GROUP BY trade_date
            ORDER BY trade_date DESC LIMIT 1
        `);
        const dpDate = dpRes.rows[0].trade_date;

        const screenCount = await query(`
            SELECT count(*) as count 
            FROM daily_prices p 
            JOIN stocks s ON p.symbol = s.symbol
            WHERE p.trade_date = $1 
            AND (s.symbol ~ '^[0-9]{4}$' AND s.symbol !~ '^00')
        `, [dpDate]);

        // Find latest date for health scores
        const hcRes = await query(`SELECT MAX(calc_date) as latest FROM stock_health_scores`);
        const hcDate = hcRes.rows[0].latest;

        const hcCount = await query(`
            SELECT count(*) as count 
            FROM stock_health_scores s
            JOIN stocks st ON s.symbol = st.symbol
            WHERE calc_date = $1 
            AND (s.symbol ~ '^[0-9]{4}$')
        `, [hcDate]);

        const diffQuery = await query(`
            SELECT h.symbol 
            FROM stock_health_scores h
            WHERE h.calc_date = $1 AND (h.symbol ~ '^[0-9]{4}$')
            AND h.symbol NOT IN (
                SELECT p.symbol 
                FROM daily_prices p 
                JOIN stocks s ON p.symbol = s.symbol
                WHERE p.trade_date = $2 
                AND (s.symbol ~ '^[0-9]{4}$' AND s.symbol !~ '^00')
            )
        `, [hcDate, dpDate]);
        console.log("Difference (stocks in health check but not in screen): ", diffQuery.rows.map(r => r.symbol));

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

main();
