const { query } = require('./server/db');
async function checkIndexes() {
    try {
        const res = await query(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'daily_prices'`);
        console.log(res.rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
checkIndexes();
