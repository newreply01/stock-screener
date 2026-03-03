const axios = require('axios');

async function checkDates() {
    try {
        console.log('--- Checking /api/market-stats ---');
        const statsRes = await axios.get('http://localhost:20002/api/market-stats');
        console.log('Market Stats Date:', statsRes.data.latestDate);

        console.log('\n--- Checking /api/market-summary ---');
        const summaryRes = await axios.get('http://localhost:20002/api/market-summary');
        console.log('Summary Latest Date:', summaryRes.data.latestDate);
        console.log('TWSE Date:', summaryRes.data.marketDates?.twse);
        console.log('TPEX Date:', summaryRes.data.marketDates?.tpex);

    } catch (err) {
        console.error('Error calling APIs:', err.message);
    }
}

checkDates();
