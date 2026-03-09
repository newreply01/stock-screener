
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'stock_screener',
    password: process.env.DB_PASSWORD || 'postgres123',
    port: parseInt(process.env.DB_PORT || '5432'),
    ssl: false
});

async function run() {
    try {
        console.log('--- Deep Table Size Analysis ---');
        
        // Use s.relid to avoid ambiguity
        const res = await pool.query(`
            SELECT 
                s.relname as table_name,
                pg_total_relation_size(s.relid) as total_size_bytes,
                s.n_live_tup as row_count
            FROM pg_stat_user_tables s
            JOIN pg_class c ON c.oid = s.relid 
            ORDER BY total_size_bytes DESC 
            LIMIT 20
        `);
        
        const rows = res.rows.map(r => ({
            table_name: r.table_name,
            size_mb: (parseInt(r.total_size_bytes) / 1024 / 1024).toFixed(2),
            row_count: r.row_count
        }));
        
        console.table(rows);

        const warrantCheck = await pool.query(`
            SELECT 
                SUM(CASE WHEN length(symbol) = 6 THEN 1 ELSE 0 END) as warrant_rows,
                COUNT(*) as total_rows
            FROM daily_prices
        `);
        const { warrant_rows, total_rows } = warrantCheck.rows[0];
        console.log(`\ndaily_prices Row Stats:`);
        console.log(`Warrant Rows: ${warrant_rows}`);
        console.log(`Total Rows: ${total_rows}`);
        console.log(`Ratio: ${(parseInt(warrant_rows) / parseInt(total_rows) * 100).toFixed(2)}%`);

    } catch (err) {
        console.error('Error during analysis:', err);
    } finally {
        await pool.end();
    }
}

run();
