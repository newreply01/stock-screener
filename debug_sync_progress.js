const { Pool } = require('pg');
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'stock_screener',
    password: 'postgres123',
    port: 5432,
});

const symbols = [
    '1210', '4746', '6226', '2395', '1712', '6446', '3653', '6176', '7780', '5519', 
    '2101', '5309', '6757', '3591', '2388', '3031', '4739', '5371', '3042', '6206', 
    '6761', '1905', '2413', '3363', '3034', '2453', '3060', '3704', '3032', '3317'
];

async function checkProgress() {
    try {
        const res = await pool.query(`
            SELECT stock_id, count(*) 
            FROM fm_stock_per 
            WHERE stock_id = ANY($1) 
            GROUP BY stock_id 
            ORDER BY stock_id ASC
        `, [symbols]);
        
        console.table(res.rows);
        console.log(`Synced stocks: ${res.rows.length} / ${symbols.length}`);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkProgress();
