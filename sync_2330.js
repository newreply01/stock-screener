const { syncStockFinancials } = require('./server/finmind_fetcher');
const { initDatabase } = require('./server/db');

async function run() {
    try {
        await initDatabase();
        console.log('🚀 Starting manual sync for 2330...');
        await syncStockFinancials('2330');
        console.log('✅ Manual sync completed.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Manual sync failed:', err);
        process.exit(1);
    }
}

run();
