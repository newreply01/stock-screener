const fetch = require('node-fetch');
const nodeFetch = fetch.default || fetch;
require('dotenv').config();

const BASE_URL = 'https://api.finmindtrade.com/api/v4/data';
const token = process.env.FINMIND_TOKENS ? process.env.FINMIND_TOKENS.split(',')[0].trim() : '';

async function test() {
    const symbol = '2330';
    const datasets = ['TaiwanStockFinancialStatements', 'TaiwanStockBalanceSheet', 'TaiwanStockCashFlows'];

    for (const dataset of datasets) {
        console.log(`\n--- Testing Dataset: ${dataset} ---`);
        const url = `${BASE_URL}?dataset=${dataset}&data_id=${symbol}&start_date=2024-01-01&token=${token}`;
        console.log(`Fetching: ${url.replace(token, 'TOKEN')}`);

        try {
            const res = await nodeFetch(url);
            const json = await res.json();

            if (json.data && json.data.length > 0) {
                console.log(`Total items: ${json.data.length}`);
                const typeCounts = {};
                const samples = {};
                json.data.forEach(item => {
                    const t = item.type || 'N/A';
                    typeCounts[t] = (typeCounts[t] || 0) + 1;
                    if (!samples[t]) samples[t] = item.origin_name;
                });

                console.log('Types found:');
                for (const t in typeCounts) {
                    console.log(`  - ${t}: ${typeCounts[t]} items (Sample: ${samples[t]})`);
                }
            } else {
                console.log('No data or empty data returned:', json.msg || 'No message');
            }
        } catch (e) {
            console.error(`Error fetching ${dataset}:`, e.message);
        }
    }
}

test();
