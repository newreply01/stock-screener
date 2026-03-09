const fetch = globalThis.fetch || require('node-fetch');

const BASE_URL = 'https://api.finmindtrade.com/api/v4/data';
const TOKEN = (process.env.FINMIND_TOKENS || process.env.FINMIND_TOKEN || '').split(',')[0].trim();

const TEST_DATES = [];
let d = new Date('2026-02-01');
const end = new Date('2026-03-08');
while (d <= end) {
    TEST_DATES.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
}
// Also include the Dec gaps
TEST_DATES.push('2025-12-24', '2025-12-25', '2025-12-26', '2025-12-29', '2025-12-30', '2025-12-31');

async function checkDate(dataset, data_id, date) {
    let url = `${BASE_URL}?dataset=${dataset}&start_date=${date}&end_date=${date}`;
    if (data_id) url += `&data_id=${data_id}`;
    if (TOKEN) url += `&token=${TOKEN}`;

    try {
        const res = await fetch(url);
        if (!res.ok) return { date, status: res.status, count: 0 };
        const json = await res.json();
        return { date, status: 200, count: (json.data || []).length };
    } catch (e) {
        return { date, status: 'ERROR', count: 0, error: e.message };
    }
}

async function checkRange(dataset, data_id, start) {
    let url = `${BASE_URL}?dataset=${dataset}&start_date=${start}`;
    if (data_id) url += `&data_id=${data_id}`;
    if (TOKEN) url += `&token=${TOKEN}`;

    try {
        const res = await fetch(url);
        if (!res.ok) return { status: res.status, count: 0 };
        const json = await res.json();
        const data = json.data || [];
        if (data.length > 0) console.log(`DEBUG_SAMPLE_${dataset}:`, JSON.stringify(data[0], null, 2));
        const dates = [...new Set(data.map(d => d.date))].sort();
        return { status: 200, count: data.length, unique_dates: dates.length, first: dates[0], last: dates[dates.length - 1], all_dates: dates };
    } catch (e) {
        console.error(`Error in checkRange(${dataset}):`, e);
        return { status: 'ERROR', error: e.message };
    }
}

async function run() {
    console.log('--- Probing FinMind API for specific date (2026-03-02) ---');
    const url = `${BASE_URL}?dataset=TaiwanStockTotalMarginPurchaseShortSale&start_date=2026-03-02&end_date=2026-03-02&token=${TOKEN}`;
    const res = await fetch(url);
    const json = await res.json();
    console.log('2026-03-02 Margin Data:', JSON.stringify(json.data, null, 2));

    const priceUrl = `${BASE_URL}?dataset=TaiwanStockTotalReturnIndex&start_date=2026-03-02&end_date=2026-03-02&data_id=TAIEX&token=${TOKEN}`;
    const priceRes = await fetch(priceUrl);
    const priceJson = await priceRes.json();
    console.log('2026-03-02 TAIEX Data:', JSON.stringify(priceJson.data, null, 2));
}

run();
