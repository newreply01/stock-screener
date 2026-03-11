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
    // Sync last 120 working days
    const dates = [];
    const d = new Date();
    for (let i = 0; i < 120; i++) {
        const target = new Date(d);
        target.setDate(d.getDate() - i);
        if (target.getDay() !== 0 && target.getDay() !== 6) {
            const y = target.getFullYear();
            const m = String(target.getMonth() + 1).padStart(2, '0');
            const day = String(target.getDate()).padStart(2, '0');
            dates.push(`${y}${m}${day}`);
        }
    }

    for (const dateStr of dates) {
        await syncIndex(dateStr);
        await new Promise(r => setTimeout(r, 1000));
    }
    process.exit(0);
}
run();
