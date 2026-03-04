const { query } = require('./server/db');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Helper functions same as fetcher.js
const parseNumber = (str) => {
    if (!str || str === '--' || str === 'N/A' || str === '') return null;
    const cleaned = String(str).replace(/,/g, '').replace(/"/g, '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
};

const toDateStr = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
};

const toDateHyphen = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

async function ensureStock(symbol, name = symbol) {
    await query(
        `INSERT INTO stocks (symbol, name) VALUES ($1, $2) ON CONFLICT (symbol) DO NOTHING`,
        [symbol, name]
    );
}

// Manually sync TWSE Institutional for a specific date
async function syncTWSEInstitutional(dateObj) {
    const dateStr = toDateStr(dateObj);
    const dateHyphen = toDateHyphen(dateObj);
    console.log(`[Inst Sync] Fetching TWSE Institutional for ${dateStr}...`);
    try {
        const url = `https://www.twse.com.tw/rwd/zh/fund/T86?response=json&selectType=ALL&date=${dateStr}`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const json = await res.json();

        if (json.stat !== 'OK' || !json.data) {
            console.log(`[Inst Sync] No data for ${dateStr}`);
            return;
        }

        let count = 0;
        for (const row of json.data) {
            const symbol = row[0];
            if (!/^\d{4,6}$/.test(symbol)) continue;

            await ensureStock(symbol);

            const foreignNet = parseNumber(row[4]) + (parseNumber(row[7]) || 0);
            const trustNet = parseNumber(row[10]);
            const dealerNet = parseNumber(row[11]);
            const totalNet = parseNumber(row[18]);

            await query(
                `INSERT INTO institutional (symbol, trade_date, foreign_net, trust_net, dealer_net, total_net)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (symbol, trade_date) DO UPDATE SET 
                    foreign_net = EXCLUDED.foreign_net,
                    trust_net = EXCLUDED.trust_net,
                    dealer_net = EXCLUDED.dealer_net,
                    total_net = EXCLUDED.total_net`,
                [symbol, dateHyphen, foreignNet, trustNet, dealerNet, totalNet]
            );
            count++;
        }
        console.log(`[Inst Sync] Updated ${count} TWSE institutional records for ${dateStr}`);
    } catch (e) {
        console.error(`[Inst Sync] Failed: ${e.message}`);
    }
}

async function run() {
    const targetDate = new Date('2026-03-03');
    await syncTWSEInstitutional(targetDate);
}

run().then(() => process.exit(0));
