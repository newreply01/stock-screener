const { pool } = require('../server/db');

async function check() {
    try {
        const res = await pool.query(`
            SELECT status, count(*), error_msg 
            FROM ai_generation_queue 
            WHERE report_date = '2026-04-02' 
            GROUP BY status, error_msg 
            ORDER BY count(*) DESC
        `);
        console.log('AI Generation Queue Status for 2026-04-02:');
        res.rows.forEach(r => {
            console.log(`- Status: ${r.status}, Count: ${r.count}, Error: ${r.error_msg || 'None'}`);
        });

        const res2 = await pool.query(`
            SELECT model_name, status, count(*) 
            FROM ai_generation_queue 
            WHERE report_date = '2026-04-02' 
            GROUP BY model_name, status 
            ORDER BY model_name, status
        `);
        console.log('\nModel Distribution:');
        res2.rows.forEach(r => {
            console.log(`- Model: ${r.model_name}, Status: ${r.status}, Count: ${r.count}`);
        });

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

check();
