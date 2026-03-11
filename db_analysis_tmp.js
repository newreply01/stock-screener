const { query, pool } = require('./server/db');
async function go() {
    try {
        const res = await query("SELECT table_name::text as table_name, pg_total_relation_size(table_name::text) as total_bytes FROM information_schema.tables WHERE table_schema = 'public' ORDER BY pg_total_relation_size(table_name::text) DESC");
        const rows = [];
        for (const table of res.rows) {
            const countRes = await query('SELECT count(*) as cnt FROM "' + table.table_name + '"');
            rows.push({
                table_name: table.table_name,
                total_mb: Math.round(table.total_bytes / 1024 / 1024 * 100) / 100,
                row_count: parseInt(countRes.rows[0].cnt)
            });
        }
        console.log(JSON.stringify(rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
        process.exit(0);
    }
}
go();
