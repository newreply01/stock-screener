const https = require('https');

const fetchJson = (url) => new Promise((resolve, reject) => {
    https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
        });
    }).on('error', reject);
});

async function test() {
    const symbols = ['tse_3231.tw', 'tse_2330.tw'];
    const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${symbols.join('|')}&json=1&delay=0&_=${Date.now()}`;
    console.log(`Fetching: ${url}`);
    try {
        const data = await fetchJson(url);
        if (data && data.msgArray) {
            data.msgArray.forEach(info => {
                console.log(`[${info.c}] ${info.n}: z=${info.z}, t=${info.t}, v=${info.v}, y=${info.y}`);
            });
        }
    } catch (e) {
        console.error('Fetch Error:', e.message);
    }
}

test();
