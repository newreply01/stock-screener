const { syncBrokers } = require('./server/finmind_fetcher');
const { end } = require('./server/db');

async function run() {
    const { pool } = require('./server/db');
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS brokers (
                id VARCHAR(10) PRIMARY KEY,
                name VARCHAR(100),
                market VARCHAR(20)
            )
        `);
        console.log('Ensured brokers table exists.');
        await syncBrokers();
        console.log('Broker sync finished.');
    } catch (e) {
        console.error(e);
    } finally {
        await end();
    }
}

run();
