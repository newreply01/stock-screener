const { fetchMarketInstitutional, fetchMarketMargin } = require('./server/twse_fetcher');
const { getTaiwanDate } = require('./server/utils/timeUtils');

async function test() {
    const today = getTaiwanDate();
    // Friday, March 20, 2026 is a trading day
    const testDate = new Date('2026-03-20');
    
    console.log(`Testing fetchMarketInstitutional for ${testDate.toISOString().split('T')[0]}...`);
    await fetchMarketInstitutional(testDate);
    
    console.log(`Testing fetchMarketMargin for ${testDate.toISOString().split('T')[0]}...`);
    await fetchMarketMargin(testDate);
    
    console.log('Test complete. Check logs and DB.');
}

test().catch(console.error);
