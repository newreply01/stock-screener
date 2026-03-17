const { Pool } = require('pg');
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'stock_screener',
    password: 'postgres123',
    port: 5432,
});

async function checkGlobalStats() {
    try {
        console.log("--- Global Valuation Sync Stats ---");
        
        // 1. Total 4-digit stocks in 'stocks' table
        const totalRes = await pool.query(`
            SELECT count(*) FROM stocks 
            WHERE symbol ~ '^[0-9]{4}$'
        `);
        const totalStocks = parseInt(totalRes.rows[0].count);

        // 2. Stocks with records in 'fm_stock_per'
        const syncedRes = await pool.query(`
            SELECT count(DISTINCT stock_id) FROM fm_stock_per
        `);
        const syncedStocks = parseInt(syncedRes.rows[0].count);

        // 3. Find some examples of unsynced stocks
        const unsyncedExamples = await pool.query(`
            SELECT symbol, name FROM stocks 
            WHERE symbol ~ '^[0-9]{4}$' 
            AND symbol NOT IN (SELECT DISTINCT stock_id FROM fm_stock_per)
            LIMIT 5
        `);

        console.log(`Total 4-digit stocks: ${totalStocks}`);
        console.log(`Synced stocks (fm_stock_per): ${syncedStocks}`);
        console.log(`Missing: ${totalStocks - syncedStocks}`);
        
        if (unsyncedExamples.rows.length > 0) {
            console.log("\nExamples of unsynced stocks:");
            console.table(unsyncedExamples.rows);
        }

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkGlobalStats();
