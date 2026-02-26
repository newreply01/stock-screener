const { pool } = require('./server/db');
async function query() {
    try {
        console.log('--- Phase 1 Progress (Table Rows) ---');
        const phase1Tables = {
            'fm_total_return_index': '報酬指數',
            'fm_total_margin': '整體融資融券',
            'fm_total_institutional': '整體法人',
            'fm_delisting': '下市櫃',
            'fm_securities_trader_info': '券商資訊'
        };
        for (const [table, name] of Object.entries(phase1Tables)) {
            const res = await pool.query(`SELECT COUNT(*) FROM "${table}"`);
            console.log(`${name} (${table}): ${res.rows[0].count} rows`);
        }

        console.log('\n--- Phase 2/3 Progress (fm_sync_progress) ---');
        const progressRes = await pool.query(`SELECT dataset, COUNT(stock_id) FROM fm_sync_progress GROUP BY dataset ORDER BY count DESC`);
        progressRes.rows.forEach(row => {
            console.log(`${row.dataset}: ${row.count} stocks completed`);
        });

        console.log('\n--- Latest Record Dates ---');
        const dateTables = ['fm_month_revenue', 'fm_stock_price', 'fm_financial_statements'];
        for (const table of dateTables) {
            const res = await pool.query(`SELECT MAX(date) FROM "${table}"`);
            console.log(`${table}: Latest date ${res.rows[0].max ? res.rows[0].max.toISOString().split('T')[0] : 'None'}`);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
query();