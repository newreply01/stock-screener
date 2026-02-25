const { initDatabase } = require('./db');
const { fetchRange } = require('./fetcher');

async function runFix() { // Fix last 30 days of data
    await initDatabase();

    // Calculate dates
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);

    console.log(`Starting fundamentals fix from ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`);

    await fetchRange(start, end);
    console.log('Fundamentals fix completed successfully.');
    process.exit(0);
}

runFix().catch(err => {
    console.error(err);
    process.exit(1);
});
