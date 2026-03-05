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
    const url = 'https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_2330.tw';
    console.log(`Fetching: ${url}`);
    try {
        const data = await fetchJson(url);
        if (data && data.msgArray && data.msgArray.length > 0) {
            console.log(JSON.stringify(data.msgArray[0], null, 2));
        }
    } catch (e) {
        console.error('Fetch Error:', e.message);
    }
}

test();
