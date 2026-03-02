const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const TPEX_DAILY_URL = 'https://www.tpex.org.tw/web/stock/aftertrading/daily_close_quotes/stk_quote_result.php?l=zh-tw&o=json';

async function testFetch() {
    const rocDate = '113/03/01'; // Try recent date
    const url = `${TPEX_DAILY_URL}&d=${rocDate}`;
    console.log("Fetching", url);
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const json = await res.json();
    console.log("Response fields:", Object.keys(json));
    if (json.aaData && json.aaData.length > 0) {
        console.log("First row example:");
        console.log(json.aaData[0]);
    } else {
        console.log("No aaData or empty aaData in response!");
    }
}
testFetch();
