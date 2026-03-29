const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const localPool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'stock_screener',
  password: process.env.DB_PASSWORD || 'postgres123',
  port: parseInt(process.env.DB_PORT || '5533'),
});

async function checkIndexes() {
    try {
        console.log('--- Index Check for realtime_ticks ---');
        const res = await localPool.query(`
            SELECT
                t.relname AS table_name,
                i.relname AS index_name,
                a.attname AS column_name
            FROM
                pg_class t,
                pg_class i,
                pg_index ix,
                pg_attribute a
            WHERE
                t.oid = ix.indrelid
                AND i.oid = ix.indexrelid
                AND a.attrelid = t.oid
                AND a.attnum = ANY(ix.indkey)
                AND t.relkind = 'r'
                AND t.relname = 'realtime_ticks'
            ORDER BY
                t.relname,
                i.relname;
        `);
        console.log('Indexes found:');
        res.rows.forEach(r => console.log(` - ${r.index_name} (Column: ${r.column_name})`));

        const constraintRes = await localPool.query(`
            SELECT conname, contype 
            FROM pg_constraint 
            WHERE conrelid = 'realtime_ticks'::regclass;
        `);
        console.log('Constraints found:');
        constraintRes.rows.forEach(r => console.log(` - ${r.conname} (Type: ${r.contype})`));

        process.exit(0);
    } catch (err) {
        console.error('Index check failed:', err);
        process.exit(1);
    }
}

checkIndexes();
