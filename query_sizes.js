const { pool } = require('./server/db');
async function query() {
    try {
        const res = await pool.query(`
            SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) as size_human, 
                   pg_total_relation_size(relid) as size_bytes
            FROM pg_stat_user_tables 
            WHERE relname ~ '^(institutional|daily_prices)_(202[1-6])$' 
               OR relname = 'fm_stock_price'
            ORDER BY relname;
        `);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
query();
