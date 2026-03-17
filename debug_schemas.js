const { Pool } = require('pg');
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'stock_screener',
    password: 'postgres123',
    port: 5432,
});

async function checkSchemas() {
    try {
        console.log("--- fundamentals schema ---");
        const fundSchema = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'fundamentals'
            ORDER BY ordinal_position
        `);
        console.table(fundSchema.rows);

        console.log("--- fm_stock_per schema ---");
        const perSchema = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'fm_stock_per'
            ORDER BY ordinal_position
        `);
        console.table(perSchema.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkSchemas();
