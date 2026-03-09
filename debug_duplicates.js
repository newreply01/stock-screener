const { query } = require('./server/db');

async function check() {
    try {
        const dupStocks = await query(`
            SELECT symbol, COUNT(*) 
            FROM stocks 
            GROUP BY symbol 
            HAVING COUNT(*) > 1
        `);
        console.log('Duplicate symbols in stocks:', dupStocks.rows);

        const constraints = await query(`
            SELECT conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE conname LIKE '%stock_health_scores%'
        `);
        console.log('Constraints for stock_health_scores:', constraints.rows);
        
        const columnDetails = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'stock_health_scores'
        `);
        console.log('Columns for stock_health_scores:', columnDetails.rows);

    } catch (e) {
        console.error(e);
    }
}

check().then(() => process.exit(0));
