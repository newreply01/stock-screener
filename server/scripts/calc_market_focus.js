const { query } = require('../db');

/**
 * Executes the Market Focus data aggregation and saves results into market_focus_daily.
 * This runs directly the same SQL queries from the old `/api/market-focus`.
 */
async function calculateMarketFocus(market = 'all', stock_types = 'stock') {
    console.log(`[Calc] Starting market-focus calculation for market=${market}, types=${stock_types}`);

    // 1. Get the latest trade_date with enough data limits and previous 3 days
    const dateDetectionSql = `
        SELECT trade_date, count(*) as count
        FROM daily_prices
        WHERE symbol ~ '^[0-9]{4}$'
        GROUP BY trade_date
        HAVING count(*) > 1500
        ORDER BY trade_date DESC
        LIMIT 3
    `;
    let datesRes = await query(dateDetectionSql);

    if (datesRes.rows.length === 0) {
        datesRes = await query('SELECT DISTINCT trade_date FROM daily_prices ORDER BY trade_date DESC LIMIT 3');
        if (datesRes.rows.length === 0) {
            console.log('[Calc] No daily price data available.');
            return;
        }
    }

    const latestDate = datesRes.rows[0].trade_date;
    const targetDates = datesRes.rows.map(r => r.trade_date);

    // Apply filters
    const types = (stock_types || 'stock').split(',');
    let typeConditions = [];
    if (types.includes('stock')) typeConditions.push("(s.symbol ~ '^[0-9]{4}$' AND s.symbol !~ '^00')");
    if (types.includes('etf')) typeConditions.push("(s.symbol ~ '^00' OR s.name ILIKE '%ETF%')");
    if (types.includes('warrant')) typeConditions.push("(s.symbol ~ '^[0-9]{6}$' AND s.symbol !~ '^00' AND s.symbol !~ '^02')");

    const typeFilter = typeConditions.length > 0 ? `AND (${typeConditions.join(' OR ')})` : '';
    const marketFilter = market !== 'all' ? `AND s.market = '${market}'` : '';

    console.log(`[Calc] Target date: ${latestDate.toISOString().split('T')[0]}, executing queries...`);

    // Parallel execution
    const [turnoverRes, hotRes, instRes] = await Promise.all([
        query(`
            SELECT s.symbol, s.name, p.close_price, p.change_percent, (p.volume * p.close_price) as turnover
            FROM daily_prices p
            JOIN stocks s ON p.symbol = s.symbol
            WHERE p.trade_date = $1 ${marketFilter} ${typeFilter}
            ORDER BY turnover DESC NULLS LAST
            LIMIT 10
        `, [latestDate]),
        query(`
            SELECT s.symbol, s.name, p.close_price, p.change_percent, p.volume
            FROM daily_prices p
            JOIN stocks s ON p.symbol = s.symbol
            WHERE p.trade_date = $1 ${marketFilter} ${typeFilter}
            ORDER BY p.volume DESC NULLS LAST
            LIMIT 10
        `, [latestDate]),
        query(`
            SELECT i.symbol, s.name, 
                   MAX(p.close_price) as close_price, 
                   MAX(p.change_percent) as change_percent,
                   SUM(i.foreign_net) as foreign_buy,
                   SUM(i.trust_net) as trust_buy,
                   SUM(i.total_net) as total_buy
            FROM institutional i
            JOIN stocks s ON i.symbol = s.symbol
            JOIN daily_prices p ON p.symbol = i.symbol AND p.trade_date = $1
            WHERE i.trade_date = ANY($2) ${marketFilter} ${typeFilter}
            GROUP BY i.symbol, s.name
        `, [latestDate, targetDates])
    ]);

    const foreignRes = [...instRes.rows].sort((a, b) => b.foreign_buy - a.foreign_buy).slice(0, 10);
    const trustRes = [...instRes.rows].sort((a, b) => b.trust_buy - a.trust_buy).slice(0, 10);
    const totalRes = [...instRes.rows].sort((a, b) => b.total_buy - a.total_buy).slice(0, 10);

    // Format Data
    const turnoverData = JSON.stringify(turnoverRes.rows);
    const hotData = JSON.stringify(hotRes.rows);
    const foreignData = JSON.stringify(foreignRes);
    const trustData = JSON.stringify(trustRes);
    const mainData = JSON.stringify(totalRes);

    // Upsert to market_focus_daily
    const upsertSql = `
        INSERT INTO market_focus_daily (trade_date, market, stock_types, turnover, hot, foreign3d, trust3d, main3d)
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb)
        ON CONFLICT (trade_date, market, stock_types) 
        DO UPDATE SET 
            turnover = EXCLUDED.turnover,
            hot = EXCLUDED.hot,
            foreign3d = EXCLUDED.foreign3d,
            trust3d = EXCLUDED.trust3d,
            main3d = EXCLUDED.main3d,
            created_at = CURRENT_TIMESTAMP
    `;

    console.log(`[Calc] Saving results to database...`);
    await query(upsertSql, [latestDate, market, stock_types, turnoverData, hotData, foreignData, trustData, mainData]);
    console.log(`[Calc] Successfully saved market-focus for ${latestDate.toISOString().split('T')[0]} (${market}/${stock_types})`);
}

/**
 * Execute for all primary combinations required by the UI.
 * - market: 'all', 'twse', 'tpex'
 * - stock_types: 'stock'
 */
async function runAll() {
    try {
        console.time('Total Calculation Time');
        await calculateMarketFocus('all', 'stock');
        await calculateMarketFocus('twse', 'stock');
        await calculateMarketFocus('tpex', 'stock');
        console.timeEnd('Total Calculation Time');
        process.exit(0);
    } catch (err) {
        console.error('[Calc] Error executing pre-calculations:', err);
        process.exit(1);
    }
}

if (require.main === module) {
    runAll();
}

module.exports = { calculateMarketFocus, runAll };
