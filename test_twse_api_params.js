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
    const timestamp = Date.now();
    // 試著加上 json=1, delay=0 和 隨機參數 _
    const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_2330.tw&json=1&delay=0&_=${timestamp}`;
    console.log(`Fetching: ${url}`);
    try {
        const data = await fetchJson(url);
        if (data && data.msgArray && data.msgArray.length > 0) {
            const info = data.msgArray[0];
            console.log(`[${info.c}] ${info.n}: z=${info.z}, t=${info.t}, v=${info.v}, y=${info.y}`);
            if (info.z === '-') {
                console.log('Warning: z is still "-"');
                console.log('Full first msg:', JSON.stringify(info, null, 2));
            }
        }
    } catch (e) {
        console.error('Fetch Error:', e.message);
    }
}

test();
