const { pool } = require('./server/db');

async function checkPartitions() {
    try {
        console.log('--- Checking Partitions for realtime_ticks ---');
        const res = await pool.query(`
            SELECT
                nmsp_parent.nspname AS parent_schema,
                parent.relname      AS parent_table,
                nmsp_child.nspname  AS child_schema,
                child.relname       AS child_table
            FROM pg_inherits
                JOIN pg_class parent            ON pg_inherits.inhparent = parent.oid
                JOIN pg_class child             ON pg_inherits.inhrelid   = child.oid
                JOIN pg_namespace nmsp_parent   ON nmsp_parent.oid  = parent.relnamespace
                JOIN pg_namespace nmsp_child    ON nmsp_child.oid   = child.relnamespace
            WHERE parent.relname='realtime_ticks';
        `);
        
        if (res.rows.length === 0) {
            console.log('No partitions found for realtime_ticks. If it is a partitioned table, this is a major issue!');
        } else {
            console.log(`Found ${res.rows.length} partitions:`);
            res.rows.forEach(r => console.log(` - ${r.child_table}`));
        }
        
        process.exit(0);
    } catch (err) {
        console.error('Partition check failed:', err);
        process.exit(1);
    }
}

checkPartitions();
