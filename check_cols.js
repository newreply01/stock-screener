const { pool } = require('./server/db');
async function main() {
    try {
        const res = await pool.query("SELECT * FROM daily_prices_2025 LIMIT 1");
        console.log(Object.keys(res.rows[0]));
    } catch(e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
main();
