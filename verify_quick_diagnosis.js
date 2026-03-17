const fetch = require('node-fetch');
const nodeFetch = fetch.default || fetch;

async function verify() {
    const symbol = '2330'; // TSMC
    const url = `http://localhost:3005/api/stock/${symbol}/quick-diagnosis`;
    
    console.log(`🔍 Testing Quick Diagnosis API for ${symbol}...`);
    try {
        const res = await nodeFetch(url);
        const json = await res.json();
        
        if (json.success) {
            console.log('✅ API Success!');
            console.log(JSON.stringify(json.data, null, 2));
        } else {
            console.error('❌ API Failed:', json.error);
        }
    } catch (err) {
        console.error('❌ Request failed:', err.message);
    }
}

verify();
