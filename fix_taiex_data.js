const { query } = require('./server/db');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const parseNumber = (str) => {
    if (!str || str === '--' || str === 'N/A' || str === '') return null;
    const cleaned = String(str).replace(/,/g, '').replace(/"/g, '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
};

async function syncIndex(dateStr) {
    // type=IND specifies Index data
    const url = `https://www.twse.com.tw/exchangeReport/MI_INDEX?response=json&type=IND&date=${dateStr}`;
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' } });
        const json = await res.json();
        if (json.stat !== 'OK') return;

        // The first table is usually "指數成交量值"
        const table = json.tables ? json.tables[0] : null;
        if (table && table.data) {
            const taiexRow = table.data.find(r => r[0] === '發行量加權股價指數');
            if (taiexRow) {
                const taiexClose = parseNumber(taiexRow[1]);
                const hyphenDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
                await query(
                    `INSERT INTO daily_prices (symbol, trade_date, close_price, open_price, high_price, low_price, volume, trade_value, transactions, change_amount, change_percent)
                     VALUES ($1, $2, $3, $3, $3, $3, 0, 0, 0, 0, 0)
                     ON CONFLICT (symbol, trade_date) DO UPDATE SET close_price = EXCLUDED.close_price`,
                    ['TAIEX', hyphenDate, taiexClose]
                );
                console.log(`[OK] ${hyphenDate}: ${taiexClose}`);
            }
        }
    } catch (e) {
        console.error(`[ERR] ${dateStr}: ${e.message}`);
    }
}

async function run() {
    console.log('Starting TAIEX backfill (60 days)...');
    const dates = [];
    const now = new Date();
    for (let i = 0; i < 80; i++) {
        const t = new Date(now);
        t.setDate(now.getDate() - i);
        if (t.getDay() === 0 || t.getDay() === 6) continue;
        const y = t.getFullYear();
        const m = String(t.getMonth() + 1).padStart(2, '0');
        const d = String(t.getDate()).padStart(2, '0');
        dates.push(`${y}${m}${d}`);
    }

    // Batch process to be polite to TWSE
    for (const d of dates) {
        await syncIndex(d);
        await new Promise(r => setTimeout(r, 1200));
    }
    console.log('Backfill finished.');
    process.exit(0);
}
run();
