const { query } = require('./server/db');

async function check() {
    try {
        console.log('--- Checking for duplicate symbols in the stocks query ---');
        const stocksRes = await query(`
            SELECT s.symbol, COUNT(*) as count
            FROM stocks s
            WHERE s.symbol ~ '^[0-9]{4}$'
            GROUP BY s.symbol
            HAVING COUNT(*) > 1
            ORDER BY s.symbol
        `);
        console.log('Duplicates found:', stocksRes.rows);

        if (stocksRes.rows.length > 0) {
            console.log('Sample duplicate details:');
            for (const row of stocksRes.rows.slice(0, 5)) {
                const details = await query('SELECT * FROM stocks WHERE symbol = $1', [row.symbol]);
                console.log(`Symbol ${row.symbol}:`, details.rows);
            }
        } else {
            console.log('No duplicates found using exact symbol match.');
            
            console.log('--- Checking for case-insensitive or whitespace duplicates ---');
            const fuzzyRes = await query(`
                SELECT TRIM(symbol) as clean_symbol, COUNT(*) as count
                FROM stocks
                WHERE symbol ~ '^[0-9]{4}$'
                GROUP BY TRIM(symbol)
                HAVING COUNT(*) > 1
            `);
            console.log('Fuzzy duplicates found:', fuzzyRes.rows);
        }

    } catch (e) {
        console.error(e);
    }
}

check().then(() => process.exit(0));
