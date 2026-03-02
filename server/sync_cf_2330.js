const { syncDetailedFinancials } = require('./finmind_fetcher');
const { pool } = require('./db');
async function run() {
    console.log('Syncing detailed financials for 2330...');
    await syncDetailedFinancials('2330');
    console.log('Done!');
    pool.end();
    process.exit(0);
}
run();
