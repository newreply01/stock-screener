const { catchUp } = require('./server/fetcher');
const { initDatabase } = require('./server/db');

async function sync() {
    try {
        await initDatabase();
        console.log('Database initialized.');
        // Sync last few days to get index
        const today = new Date();
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(today.getDate() - 60);

        const { fetchRange } = require('./server/fetcher');
        await fetchRange(sixtyDaysAgo, today);
        console.log('Sync complete.');
        process.exit(0);
    } catch (e) {
        console.error('Sync failed:', e.message);
        process.exit(1);
    }
}
sync();
