const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function check() {
    const url = 'https://www.twse.com.tw/exchangeReport/MI_INDEX?response=json&type=ALLBUT0999&date=20260303';
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' } });
        const json = await res.json();
        const table = json.tables.find(t => t.title && t.title.includes('大盤統計'));
        if (table) {
            console.log('Fields:', table.fields);
            console.log('Data (first 5):');
            console.table(table.data.slice(0, 5));
        }
    } catch (e) {
        console.error(e.message);
    }
}
check();
