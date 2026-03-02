const { query } = require('./server/db');

async function check() {
    const res = await Promise.all([
        query('SELECT MAX(trade_date) as max_date FROM daily_prices'),
        query('SELECT MAX(trade_date) as max_date FROM institutional'),
        query("SELECT count(*) FROM daily_prices WHERE trade_date > '2026-02-25'"),
        query('SELECT dataset, count(*) FROM fm_sync_progress GROUP BY dataset')
    ]);

    console.log('--- Database Status ---');
    console.log('Daily Prices Max Date:', res[0].rows[0].max_date);
    console.log('Institutional Max Date:', res[1].rows[0].max_date);
    console.log('Records after 2026-02-25:', res[2].rows[0].count);
    console.log('--- Sync Progress ---');
    console.table(res[3].rows);
    process.exit(0);
}

check().catch(e => {
    console.error(e);
    process.exit(1);
});
