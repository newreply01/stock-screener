const { pool } = require('./server/db');
const fs = require('fs');

async function run() {
    try {
        const res1 = await pool.query("SELECT DISTINCT item FROM fm_financial_statements");
        const res2 = await pool.query("SELECT DISTINCT type FROM fm_balance_sheet");
        let output = '=== fm_financial_statements items ===\n' + res1.rows.map(r => r.item).join('\n') + '\n\n';
        output += '=== fm_balance_sheet types ===\n' + res2.rows.map(r => r.type).join('\n');
        fs.writeFileSync(__dirname + '/financial_keys.txt', output);
        console.log('✅ Keys dumped to financial_keys.txt');
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
run();
