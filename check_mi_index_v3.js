const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const fs = require('fs');

async function check() {
    // Try type=IND for specific index data
    const url = 'https://www.twse.com.tw/exchangeReport/MI_INDEX?response=json&type=IND&date=20260303';
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' } });
        const json = await res.json();
        fs.writeFileSync('/home/xg/stock-screener/ind_raw.json', JSON.stringify(json, null, 2));
        console.log('Saved ind_raw.json');
    } catch (e) {
        console.error(e.message);
    }
}
check();
