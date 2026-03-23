const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });
const fetch = require('node-fetch');
const nodeFetch = fetch.default || fetch;

async function checkFinMind() {
    const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockTotalInstitutionalInvestors&data_id=&start_date=2026-03-10`;
    const res = await nodeFetch(url);
    const json = await res.json();
    console.log('Sample Data from FinMind:');
    if (json.data && json.data.length > 0) {
        console.log(json.data[0]);
    } else {
        console.log('No data found.');
    }
}

checkFinMind();
