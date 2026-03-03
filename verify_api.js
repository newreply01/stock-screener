const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function verify() {
    try {
        const res = await fetch('http://localhost:3000/api/market-margin');
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
            const last = json.data[json.data.length - 1];
            console.log('--- Latest Market Margin Data ---');
            console.log(JSON.stringify(last, null, 2));

            const hasIndex = last.index_price !== null;
            const shortVal = parseFloat(last.short_balance);
            const hasShort = shortVal > 0;

            console.log(`\nHas Index: ${hasIndex} (${last.index_price})`);
            console.log(`Has Short Balance: ${hasShort} (${last.short_balance})`);
        } else {
            console.log('API returned no data or success=false');
        }
    } catch (e) {
        console.error('Fetch error:', e.message);
    }
}
verify();
