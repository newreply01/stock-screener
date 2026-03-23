const { query, end } = require('./server/db');

async function test() {
    try {
        const res = await query("SELECT COUNT(*) FROM fm_total_institutional");
        console.log('Count in fm_total_institutional:', res.rows[0].count);
    } catch (err) {
        console.error('Test failed:', err.message);
    } finally {
        await end();
        process.exit(0);
    }
}

test();
