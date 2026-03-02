const { pool } = require('./server/db');

async function runAudit() {
    const tables = [
        'stocks',
        'daily_prices',
        'fundamentals',
        'institutional',
        'monthly_revenue',
        'financial_statements',
        'dividend_policy',
        'realtime_ticks'
    ];

    const results = {};
    for (const table of tables) {
        try {
            const existsRes = await pool.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)", [table]);
            if (!existsRes.rows[0].exists) {
                results[table] = { status: 'Table does not exist' };
                continue;
            }

            const countRes = await pool.query(`SELECT COUNT(*) FROM ${table}`);
            let latest = 'N/A';

            if (table === 'stocks') {
                const res = await pool.query('SELECT MAX(updated_at) as m FROM stocks');
                latest = res.rows[0].m;
            } else if (table === 'realtime_ticks') {
                const res = await pool.query('SELECT MAX(trade_time) as m FROM realtime_ticks');
                latest = res.rows[0].m;
            } else if (table === 'monthly_revenue') {
                const res = await pool.query('SELECT MAX(revenue_year) as y, MAX(revenue_month) as m FROM monthly_revenue');
                latest = `${res.rows[0].y}-${res.rows[0].m}`;
            } else if (table === 'financial_statements') {
                const res = await pool.query('SELECT MAX(date) as m FROM financial_statements');
                latest = res.rows[0].m;
            } else if (table === 'dividend_policy') {
                const res = await pool.query('SELECT MAX(year) as m FROM dividend_policy');
                latest = res.rows[0].m;
            } else {
                const res = await pool.query(`SELECT MAX(trade_date) as m FROM ${table}`);
                latest = res.rows[0].m;
            }

            results[table] = {
                count: parseInt(countRes.rows[0].count),
                latest: latest
            };
        } catch (e) {
            results[table] = { error: e.message };
        }
    }

    console.log('---AUDIT_START---');
    console.log(JSON.stringify(results, null, 2));
    console.log('---AUDIT_END---');
    pool.end();
}

runAudit();
