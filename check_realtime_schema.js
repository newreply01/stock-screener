const { pool } = require('./server/db');

async function checkTables() {
    try {
        const res = await pool.query(`
            SELECT tablename 
            FROM pg_catalog.pg_tables 
            WHERE schemaname = 'public' 
            AND tablename LIKE 'realtime_ticks%'
        `);
        console.log('Tables found:', res.rows.map(r => r.tablename));

        const schemaRes = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'realtime_ticks'
        `);
        console.log('\nrealtime_ticks columns:');
        console.table(schemaRes.rows);

    } catch (err) {
        console.error('Check failed:', err.message);
    } finally {
        await pool.end();
    }
}

checkTables();
