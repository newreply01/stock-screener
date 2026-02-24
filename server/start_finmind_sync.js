const { syncAllStocksFinancials } = require('./finmind_fetcher');

console.log('🚀 Starting background FinMind sync...');
syncAllStocksFinancials().then(() => {
    console.log('✅ Sync complete.');
    process.exit(0);
}).catch(err => {
    console.error('❌ Sync failed:', err);
    process.exit(1);
});
