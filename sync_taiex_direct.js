const { query } = require('./server/db');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const parseNumber = (str) => {
    if (!str || str === '--' || str === 'N/A' || str === '') return null;
    const cleaned = String(str).replace(/,/g, '').replace(/"/g, '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
};

async function syncIndex(dateStr) {
    const url = `https://www.twse.com.tw/exchangeReport/MI_INDEX?response=json&type=ALLBUT0999&date=${dateStr}`;
    console.log(`Fetching ${url}...`);
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' } });
        const json = await res.json();
        if (json.stat !== 'OK') {
            console.log(`No data for ${dateStr}: ${json.stat}`);
            return;
        }
        const indexTable = json.tables.find(t => t.title && t.title.includes('價格指數'));
        if (indexTable && indexTable.data) {
            const taiexRow = indexTable.data.find(r => r[0] && r[0].includes('發行量加權股價指數'));
            if (taiexRow) {
                const taiexClose = parseNumber(taiexRow[1]);
                const hyphenDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
                await query(
                    `INSERT INTO daily_prices (symbol, trade_date, close_price, open_price, high_price, low_price)
                     VALUES ($1, $2, $3, $3, $3, $3)
                     ON CONFLICT (symbol, trade_date) DO UPDATE SET 
                        close_price = EXCLUDED.close_price,
                        open_price = EXCLUDED.open_price,
                        high_price = EXCLUDED.high_price,
                        low_price = EXCLUDED.low_price`,
                    ['TAIEX', hyphenDate, taiexClose]
                );
                console.log(`Updated TAIEX for ${hyphenDate}: ${taiexClose}`);
            } else {
                console.log(`TAIEX row not found in ${dateStr}`);
            }
        } else {
            console.log(`Index table not found for ${dateStr}`);
        }
    } catch (e) {
        console.error(`${dateStr} failed:`, e.message);
    }
}

async function run() {
    try {
        const res = await query("SELECT MIN(trade_date) as min_date FROM daily_prices");
        const minDate = res.rows[0].min_date;
        if (!minDate) {
            console.log("No price data found in database. Exiting.");
            process.exit(0);
        }

        const startDate = new Date(minDate);
        const endDate = new Date();
        const dates = [];
        
        let current = new Date(startDate);
        while (current <= endDate) {
            if (current.getDay() !== 0 && current.getDay() !== 6) {
                const y = current.getFullYear();
                const m = String(current.getMonth() + 1).padStart(2, '0');
                const day = String(current.getDate()).padStart(2, '0');
                dates.push(`${y}${m}${day}`);
            }
            current.setDate(current.getDate() + 1);
        }

        console.log(`Preparing to sync ${dates.length} trading days from ${minDate.toISOString().split('T')[0]}...`);
        
        // Sync in reverse (newest first) to get latest data quickly if interrupted
        dates.reverse();

        for (const dateStr of dates) {
            await syncIndex(dateStr);
            await new Promise(r => setTimeout(r, 1000));
        }
    } catch (err) {
        console.error("Run error:", err);
    }
    process.exit(0);
}
run();
