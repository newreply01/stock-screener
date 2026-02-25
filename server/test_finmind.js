const { fetchFinMind } = require('./finmind_full_sync');

async function test() {
    console.log('🚀 Testing FinMind API for 6180...');
    const data = await fetchFinMind('TaiwanStockInstitutionalInvestorsBuySell', '6180', '2026-02-01');
    console.log(`📊 Received ${data.length} records.`);
    if (data.length > 0) {
        console.log('🔍 Sample data:', JSON.stringify(data[0]));
    }
    process.exit(0);
}

test().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
