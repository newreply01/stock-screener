const { fetchTWSE } = require('./server/fetcher');
const { initDatabase } = require('./server/db');

async function debug() {
    try {
        await initDatabase();
        // Today or yesterday
        const date = new Date('2026-03-03');
        await fetchTWSE(date);
        console.log('Debug Sync complete.');
        process.exit(0);
    } catch (e) {
        console.error('Debug Sync failed:', e.message);
        process.exit(1);
    }
}
debug();
