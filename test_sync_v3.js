const { catchUp } = require('./server/fetcher');
const { initDatabase } = require('./server/db');

async function runTest() {
    console.log('--- Manual Sync Trigger (v3) ---');
    console.log('Time:', new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }));
    
    try {
        console.log('Connecting to database...');
        await initDatabase();
        
        console.log('Starting catchUp process...');
        await catchUp();
        
        console.log('\n--- Sync Finished ---');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ Sync Failed:', err.message);
        process.exit(1);
    }
}

runTest();
