const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require('dotenv').config({ path: '.env' });

async function test() {
    try {
        const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockTotalMarginPurchaseShortSale&start_date=2024-01-01&end_date=2024-01-05&token=${process.env.FINMIND_TOKEN || ''}`;
        const res = await fetch(url);
        const json = await res.json();
        console.log("Raw FinMind Data Sample:");
        console.log(JSON.stringify(json.data.slice(0, 2), null, 2));
    } catch (e) {
        console.error(e);
    }
}
test();
