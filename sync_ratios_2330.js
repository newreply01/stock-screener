const { syncFinancialRatios } = require('./server/finmind_fetcher');
syncFinancialRatios('2330')
    .then(() => {
        console.log('✅ Sync 2330 ratios done');
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Sync failed:', err);
        process.exit(1);
    });
