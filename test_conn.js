const { pool } = require('./server/db');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Mocking some of the sync logic to test Connectivity
async function test() {
    console.log('--- Test Sync Starting ---');
    try {
        const res = await pool.query("SELECT 1");
        console.log('DB Connection OK');

        // Try a tiny fetch
        const dataset = 'TaiwanStockInfo';
        const url = `https://api.finmindtrade.com/api/v4/data?dataset=${dataset}`;
        const resp = await fetch(url);
        console.log(`FinMind API Check Status: ${resp.status}`);

        process.exit(0);
    } catch (err) {
        console.error('Test Failed:', err);
        process.exit(1);
    }
}
test();
