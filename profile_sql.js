const { query } = require('./server/db');

async function profile() {
    console.time('dateDetection');
    await query(`
        SELECT trade_date, count(*) as count
        FROM daily_prices
        WHERE trade_date IN (
            SELECT DISTINCT trade_date FROM daily_prices ORDER BY trade_date DESC LIMIT 5
        )
        AND symbol ~ '^[0-9]{4}$'
        GROUP BY trade_date
        ORDER BY trade_date DESC
    `);
    console.timeEnd('dateDetection');

    const trade_date = '2026-03-04'; // today

    console.time('twseDate');
    await query(`
        SELECT p.trade_date as max_date 
        FROM daily_prices p 
        JOIN stocks s ON p.symbol = s.symbol 
        WHERE s.market = 'twse' AND p.volume > 0 AND s.symbol ~ '^[0-9]{4}$'
        GROUP BY p.trade_date
        HAVING count(*) > 500
        ORDER BY p.trade_date DESC LIMIT 1
    `);
    console.timeEnd('twseDate');

    console.time('distribution');
    await query(`
        SELECT
        COUNT(*) filter(where change_percent >= 9.5) as limit_up,
        COUNT(*) filter(where change_percent >= 5 AND change_percent < 9.5) as up_5,
        COUNT(*) filter(where change_percent >= 2 AND change_percent < 5) as up_2_5,
        COUNT(*) filter(where change_percent > 0 AND change_percent < 2) as up_0_2,
        COUNT(*) filter(where change_percent = 0) as flat,
        COUNT(*) filter(where change_percent > -2 AND change_percent < 0) as down_0_2,
        COUNT(*) filter(where change_percent > -5 AND change_percent <= -2) as down_2_5,
        COUNT(*) filter(where change_percent > -9.5 AND change_percent <= -5) as down_5,
        COUNT(*) filter(where change_percent <= -9.5) as limit_down
        FROM daily_prices p
        JOIN stocks s ON p.symbol = s.symbol
        WHERE p.trade_date = $1 AND (s.symbol ~ '^[0-9]{4}$' AND s.symbol !~ '^00')
    `, [trade_date]);
    console.timeEnd('distribution');

    console.time('industry');
    await query(`
        SELECT
        s.industry,
        AVG(p.change_percent) as avg_change,
        COUNT(*) as stock_count
        FROM daily_prices p
        JOIN stocks s ON p.symbol = s.symbol
        WHERE p.trade_date = $1 AND s.industry IS NOT NULL AND s.industry != '' AND (s.symbol ~ '^[0-9]{4}$' AND s.symbol !~ '^00')
        GROUP BY s.industry
        ORDER BY avg_change DESC
        LIMIT 20
    `, [trade_date]);
    console.timeEnd('industry');

    console.time('parallel_6');
    await Promise.all([
        query(`
            SELECT s.symbol, s.name, p.close_price, p.change_percent, p.volume, TO_CHAR(p.trade_date, 'YYYY-MM-DD') as date
            FROM daily_prices p
            JOIN stocks s ON p.symbol = s.symbol
            WHERE p.trade_date = $1 AND s.market = 'twse' AND (s.symbol ~ '^[0-9]{4}$' AND s.symbol !~ '^00')
            ORDER BY p.volume DESC LIMIT 10
        `, [trade_date]),
        query(`
            SELECT s.symbol, s.name, p.close_price, p.change_amount, p.volume
            FROM daily_prices p
            JOIN stocks s ON p.symbol = s.symbol
            WHERE p.trade_date = $1 AND s.market = 'twse' AND p.change_amount IS NOT NULL AND (s.symbol ~ '^[0-9]{4}$' AND s.symbol !~ '^00')
            ORDER BY p.change_amount DESC LIMIT 10
        `, [trade_date]),
        query(`
            SELECT s.symbol, s.name, p.close_price, p.change_amount, p.volume
            FROM daily_prices p
            JOIN stocks s ON p.symbol = s.symbol
            WHERE p.trade_date = $1 AND s.market = 'twse' AND p.change_amount IS NOT NULL AND (s.symbol ~ '^[0-9]{4}$' AND s.symbol !~ '^00')
            ORDER BY p.change_amount ASC LIMIT 10
        `, [trade_date])
    ]);
    console.timeEnd('parallel_6');

    process.exit(0);
}
profile();
