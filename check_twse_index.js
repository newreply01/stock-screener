const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function checkIndex() {
    const url = 'https://www.twse.com.tw/exchangeReport/MI_INDEX?response=json&type=ALLBUT0999&date=20260303';
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' } });
        const json = await res.json();
        console.log('--- Table Titles ---');
        console.log(json.tables.map(t => t.title).join('\n'));

        const indexTable = json.tables.find(t => t.title && t.title.includes('大盤統計'));
        if (indexTable) {
            console.log('\n--- Index Table Data ---');
            console.table(indexTable.data);
        }
    } catch (e) {
        console.error(e.message);
    }
}
checkIndex();
