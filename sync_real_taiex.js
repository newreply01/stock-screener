const { query } = require('./server/db');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// TWSE Index History (FMTQIK - Daily Market Report)
// Contains '發行量加權股價指數' (TAIEX)
async function syncRealTaiex() {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    console.log(`[TAIEX Sync] Fetching history for ${dateStr}...`);

    try {
        const url = `https://www.twse.com.tw/exchangeReport/FMTQIK?response=json&date=${dateStr}`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const json = await res.json();

        if (json.stat !== 'OK' || !json.data) {
            console.error(`[TAIEX Sync] Failed: ${json.stat}`);
            return;
        }

        // data format: [ROC Date, Volume, Value, Transactions, Index, Change]
        // Example: ["113/03/04", "8,123,456,789", "345,678,901,234", "1,234,567", "19,305.32", "-112.10"]
        let count = 0;
        for (const row of json.data) {
            const rocDateParts = row[0].split('/');
            const year = parseInt(rocDateParts[0]) + 1911;
            const month = rocDateParts[1];
            const day = rocDateParts[2];
            const tradeDate = `${year}-${month}-${day}`;
            const indexValue = parseFloat(row[4].replace(/,/g, ''));

            if (isNaN(indexValue)) continue;

            await query(
                `INSERT INTO daily_prices (symbol, trade_date, close_price)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (symbol, trade_date) DO UPDATE SET close_price = EXCLUDED.close_price`,
                ['TAIEX', tradeDate, indexValue]
            );
            count++;
        }
        console.log(`[TAIEX Sync] Updated ${count} historical points for TAIEX.`);
    } catch (e) {
        console.error(`[TAIEX Sync] Error: ${e.message}`);
    }
}

syncRealTaiex().then(() => process.exit(0));
