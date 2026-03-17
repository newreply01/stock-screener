const { pool } = require('./server/db');
const fs = require('fs');

async function run() {
    try {
        const tables = ['fundamentals', 'daily_prices', 'indicators', 'monthly_revenue', 'institutional_2025'];
        let output = '';
        for (const t of tables) {
            const res = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = '${t}'`);
            output += `Table: ${t}\nColumns: ${res.rows.map(r => r.column_name).join(', ')}\n\n`;
        }
        fs.writeFileSync(__dirname + '/db_audit.txt', output);
        console.log('✅ DB Audit Complete');
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
run();
