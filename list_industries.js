const { pool } = require('./server/db');

async function run() {
    try {
        const res = await pool.query(`
            SELECT industry, count(*) 
            FROM stocks 
            GROUP BY industry 
            ORDER BY count DESC
        `);
        // Log as raw text to avoid table truncation
        res.rows.forEach(r => {
            console.log(`${r.industry || 'NULL'}: ${r.count}`);
        });
        
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
run();
