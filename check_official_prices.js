const fetch = require('node-fetch');
const nodeFetch = fetch.default || fetch;

async function checkOfficial() {
    const dates = ['20260309', '20260310'];
    for (const d of dates) {
        console.log(`--- Official Data for ${d} ---`);
        const url = `https://www.twse.com.tw/exchangeReport/MI_INDEX?response=json&type=ALLBUT0999&date=${d}`;
        try {
            const res = await nodeFetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const json = await res.json();
            if (json.stat === 'OK') {
                const table = json.tables.find(t => t.title && t.title.includes('每日收盤行情'));
                if (table) {
                    const tsmc = table.data.find(r => r[0] === '2330');
                    if (tsmc) {
                        console.log(`TSMC (2330) Close: ${tsmc[8]}, Change: ${tsmc[9]}${tsmc[10]}`);
                    }
                }
            } else {
                console.log(`Stat: ${json.stat}`);
            }
        } catch (e) {
            console.error(`Error fetching ${d}:`, e.message);
        }
    }
}

checkOfficial();
