const { pool } = require('./server/db');
const fs = require('fs');

async function dump() {
    const client = await pool.connect();
    try {
        const res = await client.query("SELECT type, item, count(*) FROM fm_financial_statements WHERE stock_id = '2330' GROUP BY type, item ORDER BY type");
        fs.writeFileSync('2330_types.json', JSON.stringify(res.rows, null, 2));
        console.log('Dumped to 2330_types.json');
    } catch (err) {
        console.error('Dump failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

dump();
