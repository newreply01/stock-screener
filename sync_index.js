const { catchUp } = require('./server/fetcher');
const { initDatabase } = require('./server/db');

async function sync() {
    try {
        await initDatabase();
        console.log('Database initialized.');
        await catchUp();
        console.log('Sync complete.');
        process.exit(0);
    } catch (e) {
        console.error('Sync failed:', e.message);
        process.exit(1);
    }
}
sync();
