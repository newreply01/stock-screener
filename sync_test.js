const { syncDetailedFinancials, syncFinancialRatios } = require('./server/finmind_fetcher');
const { pool } = require('./server/db');

async function run() {
    try {
        const symbol = '2330';
        console.log(`--- Starting Full Sync for ${symbol} ---`);
        await syncDetailedFinancials(symbol);
        await syncFinancialRatios(symbol);
        console.log('--- Sync Finished ---');
    } catch (err) {
        console.error('Sync failed:', err);
    } finally {
        await pool.end();
    }
}

run();
