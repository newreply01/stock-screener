const { query, end } = require('./server/db');

async function check() {
    try {
        const res = await query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
        console.log('Tables in DB:');
        res.rows.forEach(r => console.log(' - ' + r.table_name));
    } catch (err) {
        console.error('Check failed:', err.message);
    } finally {
        await end();
        process.exit(0);
    }
}

check();
