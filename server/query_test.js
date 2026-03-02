const { pool } = require('./db');
const fs = require('fs');

async function test() {
    try {
        const r1 = await pool.query("SELECT type, COUNT(*) FROM fm_financial_statements WHERE stock_id = '2330' GROUP BY type");
        const r1b = await pool.query("SELECT item, COUNT(*) FROM fm_financial_statements WHERE stock_id = '2330' GROUP BY item");
        const r2 = await pool.query("SELECT COUNT(*) FROM fm_dividend WHERE stock_id = '2330'");

        const output = {
            categories: r1b.rows,
            types: r1.rows.slice(0, 10),
            dividends_count: r2.rows[0].count
        };

        fs.writeFileSync('/home/xg/db_out.json', JSON.stringify(output, null, 2));
        console.log('Saved to /home/xg/db_out.json');
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        pool.end();
        process.exit(0);
    }
}

test();
