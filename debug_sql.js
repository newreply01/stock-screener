const { query } = require('./server/db');

async function debug() {
    try {
        console.log('--- Constraints ---');
        const constraints = await query(`
            SELECT conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            JOIN pg_class t ON t.relname = 'stock_health_scores'
            WHERE c.conrelid = t.oid;
        `);
        console.log(JSON.stringify(constraints.rows, null, 2));

        console.log('\n--- Indices ---');
        const indices = await query(`
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'stock_health_scores';
        `);
        console.log(JSON.stringify(indices.rows, null, 2));

        console.log('\n--- Table Structure ---');
        const columns = await query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'stock_health_scores';
        `);
        console.log(JSON.stringify(columns.rows, null, 2));

        console.log('\n--- Partitioning ---');
        const partitions = await query(`
            SELECT relname, relkind 
            FROM pg_class c 
            JOIN pg_namespace n ON n.oid = c.relnamespace 
            WHERE relkind = 'p' AND relname = 'stock_health_scores';
        `);
        console.log(JSON.stringify(partitions.rows, null, 2));

        console.log('\n--- Duplicate Check in Batch ---');
        // Check if the query for stocks returns duplicates
        const dupStocks = await query(`
            SELECT symbol, COUNT(*) 
            FROM stocks 
            WHERE symbol ~ '^[0-9]{4}$'
            GROUP BY symbol 
            HAVING COUNT(*) > 1
        `);
        console.log('Duplicate symbols in stocks:', dupStocks.rows);

    } catch (e) {
        console.error(e);
    }
}

debug().then(() => process.exit(0));
