const { pool } = require('./server/db');

async function run() {
    try {
        const res = await pool.query(`
            SELECT industry, count(*) 
            FROM stocks 
            GROUP BY industry 
            ORDER BY count DESC
        `);
        console.table(res.rows);
        
        const totalFiltered = await pool.query(`
            SELECT count(*) 
            FROM stocks 
            WHERE industry NOT IN ('認購權證', '認售權證', '牛證', '熊證', '受益證券-資產產物證券化', '存託憑證') -- Common warrant/derivative types
              OR industry IS NULL
        `);
        console.log('Filtered Count (Expected Stocks/ETFs):', totalFiltered.rows[0].count);
        
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
run();
