const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const BASE = 'https://api.finmindtrade.com/api/v4/data';
const TOKEN = process.env.FINMIND_TOKENS?.split(',')[0] || '';

async function testApi() {
    try {
        console.log("Fetching TAIEX Margin...");
        const mUrl = `${BASE}?dataset=TaiwanStockTotalMarginPurchaseShortSale&start_date=2024-01-01${TOKEN ? '&token=' + TOKEN : ''}`;
        const mRes = await fetch(mUrl);
        const mData = await mRes.json();

        console.log("Margin samples:", mData.data ? mData.data.slice(0, 5) : mData);

        console.log("Fetching TAIEX Index...");
        const tUrl = `${BASE}?dataset=TaiwanStockPrice&data_id=TAIEX&start_date=2024-01-01${TOKEN ? '&token=' + TOKEN : ''}`;
        const tRes = await fetch(tUrl);
        const tData = await tRes.json();
        console.log("TAIEX samples:", tData.data ? tData.data.slice(0, 5) : tData);

    } catch (e) {
        console.error(e);
    }
}
testApi();
