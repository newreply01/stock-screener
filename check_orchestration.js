const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function safeSync(name, fn) {
    console.log(`\n⏳ [${new Date().toLocaleTimeString()}] 開始同步: ${name}`);
    try {
        await fn();
        console.log(`✅ [${new Date().toLocaleTimeString()}] 完成同步: ${name}`);
    } catch (e) {
        console.error(`⚠️ [${name}] 失敗，跳過: ${e.message}`);
    }
    await sleep(200); // shortened for test
}

async function syncAll() {
    console.log('--- Mock Sync All Start ---');
    await safeSync('Test1', async () => { console.log('Running Test1'); });
    await safeSync('Test2', async () => { console.log('Running Test2'); });
    console.log('--- Mock Sync All End ---');
}

syncAll().then(() => {
    console.log('🎉 Done!');
    process.exit(0);
}).catch(err => {
    console.error('❌ Fatal:', err);
    process.exit(1);
});
