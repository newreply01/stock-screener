const { fetchRange } = require('./fetcher');
const { initDatabase } = require('./db');

async function run() {
    console.log('🚀 Starting manual backfill for Institutional Data (2026-02-01 -> 2026-02-24)...');
    await initDatabase();
    const start = new Date('2026-02-01');
    const end = new Date('2026-02-24');
    await fetchRange(start, end);
    console.log('✅ Backfill completed!');
    process.exit(0);
}

run().catch(err => {
    console.error('❌ Backfill failed:', err);
    process.exit(1);
});
