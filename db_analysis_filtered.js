const { query, pool } = require('./server/db');
async function go() {
    try {
        const rangeRes = await query("SELECT MIN(trade_time) as min_time, MAX(trade_time) as max_time, COUNT(*) as cnt FROM realtime_ticks");
        console.log("Realtime Ticks Range:", JSON.stringify(rangeRes.rows[0], null, 2));

        const SYMBOL_FILTER = "(SELECT symbol FROM stocks WHERE industry IS NOT NULL AND industry NOT LIKE '%權證%' AND industry NOT LIKE '%牛證%' AND industry NOT LIKE '%熊證%')";
        const manualTables = [
            'stocks',
            'daily_prices_2025',
            'daily_prices_2026',
            'institutional_2025',
            'institutional_2026',
            'fm_stock_price',
            'realtime_ticks',
            'snapshot_last_close'
        ];

        const filters = {
            'stocks': "WHERE industry IS NOT NULL AND industry NOT LIKE '%權證%' AND industry NOT LIKE '%牛證%' AND industry NOT LIKE '%熊證%'",
            'daily_prices_2025': `WHERE symbol IN ${SYMBOL_FILTER}`,
            'daily_prices_2026': `WHERE symbol IN ${SYMBOL_FILTER}`,
            'institutional_2025': `WHERE symbol IN ${SYMBOL_FILTER}`,
            'institutional_2026': `WHERE symbol IN ${SYMBOL_FILTER}`,
            'fm_stock_price': `WHERE stock_id IN ${SYMBOL_FILTER} AND date >= '2025-01-01'`,
            'realtime_ticks': `WHERE symbol IN ${SYMBOL_FILTER}`,
            'snapshot_last_close': `WHERE symbol IN ${SYMBOL_FILTER}`
        };

        const results = [];
        for (const table of manualTables) {
            const filter = filters[table] || "";
            const countRes = await query(`SELECT count(*) as cnt FROM "${table}" ${filter}`);
            const totalRes = await query(`SELECT count(*) as cnt FROM "${table}"`);
            
            results.push({
                table,
                filtered_rows: parseInt(countRes.rows[0].cnt),
                total_rows: parseInt(totalRes.rows[0].cnt),
                percentage: (parseInt(countRes.rows[0].cnt) / parseInt(totalRes.rows[0].cnt) * 100).toFixed(2) + '%'
            });
        }
        console.log(JSON.stringify(results, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
        process.exit(0);
    }
}
go();
