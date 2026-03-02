const { pool } = require('./server/db');

async function diagnose() {
    const client = await pool.connect();
    try {
        console.log('--- DB Diagnose ---');
        const dbRes = await client.query('SELECT current_database(), current_user');
        console.log('Connected to:', dbRes.rows[0]);

        const tableRes = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'fm_%'");
        console.log('Tables found:', tableRes.rows.map(r => r.table_name));

        const countRes = await client.query("SELECT count(*) FROM fm_financial_statements");
        console.log('Total rows in fm_financial_statements:', countRes.rows[0].count);

        const s2330Res = await client.query("SELECT stock_id, count(*) FROM fm_financial_statements WHERE stock_id LIKE '%2330%' GROUP BY stock_id");
        console.log('Stock 2330 count via LIKE:', s2330Res.rows);

        const exactRes = await client.query("SELECT count(*) FROM fm_financial_statements WHERE stock_id = '2330'");
        console.log('Stock 2330 count via exact match:', exactRes.rows[0].count);

        const sampleRes = await client.query("SELECT stock_id, length(stock_id) as len, type, item FROM fm_financial_statements LIMIT 5");
        console.log('Sample rows:', sampleRes.rows);

    } catch (err) {
        console.error('Diagnose failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

diagnose();
