const { query } = require('./server/db');

async function check() {
    try {
        const res = await query(`
            SELECT 
                TO_CHAR(trade_time AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD') as date, 
                COUNT(*) as count 
            FROM realtime_ticks 
            WHERE trade_time > NOW() - INTERVAL '3 days'
            GROUP BY 1
            ORDER BY 1 DESC
        `);
        console.log('Realtime Ticks counts:');
        console.log(res.rows);
    } catch (e) {
        console.error(e);
    }
}

check();
