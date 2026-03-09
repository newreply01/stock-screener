const { pool, query } = require('../db');

async function analyze() {
    console.log('--- Table Size ---');
    try {
        const counts = await query(`
            SELECT 
                (SELECT count(*) FROM fm_total_margin) as total_rows,
                (SELECT count(DISTINCT date) FROM fm_total_margin) as distinct_dates,
                (SELECT count(*) FROM daily_prices) as price_rows
        `);
        console.log(counts.rows[0]);

        console.log('\n--- Index Symbols ---');
        const syms = await query(`
            SELECT symbol, name FROM stocks 
            WHERE name LIKE '%發行量加權%' 
               OR name = '加權指數' 
               OR symbol = 'TAIEX' 
               OR symbol = 'IX0001'
        `);
        console.log(syms.rows);

        console.log('\n--- Distinct Names in fm_total_margin ---');
        const names = await query(`SELECT name, count(*) FROM fm_total_margin GROUP BY name`);
        console.log(names.rows);

        console.log('\n--- Sample for a specific date (Latest) ---');
        const latestDate = await query(`SELECT max(date) FROM fm_total_margin`);
        const date = latestDate.rows[0].max;
        console.log('Latest Date:', date);
        const sample = await query(`SELECT * FROM fm_total_margin WHERE date = $1`, [date]);
        console.log(sample.rows);

        console.log('\n--- Check for heavy categories (might cause slowness in GROUP BY) ---');
        const topDates = await query(`
            SELECT date, count(*) 
            FROM fm_total_margin 
            GROUP BY date 
            HAVING count(*) > 5 
            LIMIT 5
        `);
        console.log('Dates with >5 records:', topDates.rows);

        console.log('\n--- Connection Pool Stats ---');
        console.log('Total:', pool.totalCount, 'Idle:', pool.idleCount, 'Waiting:', pool.waitingCount);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

analyze();
