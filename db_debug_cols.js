const { pool } = require('./server/db');

async function debug() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'institutional_old_backup' 
            ORDER BY ordinal_position
        `);
        console.log('--- institutional_old_backup Columns ---');
        res.rows.forEach(r => console.log(`${r.column_name} (${r.data_type})`));

        const res2 = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'daily_prices_old_backup' 
            ORDER BY ordinal_position
        `);
        console.log('\n--- daily_prices_old_backup Columns ---');
        res2.rows.forEach(r => console.log(`${r.column_name} (${r.data_type})`));

    } catch (e) {
        console.error(e.message);
    } finally {
        client.release();
        process.exit(0);
    }
}

debug();
