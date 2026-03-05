const { query } = require('./server/db');

async function checkSchema() {
    try {
        const res = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'system_status'
            ORDER BY ordinal_position
        `);
        console.log('Columns for system_status:');
        console.log(res.rows);
    } catch (e) {
        console.error(e);
    }
}

checkSchema();
