const { pool } = require('./server/db');
async function q() {
    try {
        const s = await pool.query("SELECT COUNT(*) FROM stocks WHERE symbol ~ '^[0-9]{4}$'");
        const p = await pool.query("SELECT COUNT(DISTINCT stock_id) FROM fm_stock_price");
        console.log(`Stocks (4-digit): ${s.rows[0].count}`);
        console.log(`Stocks with Price: ${p.rows[0].count}`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
q();
