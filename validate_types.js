const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function validate() {
    const baseUrl = 'http://localhost:3000/api/screen';

    // Test 1: Ordinary Stocks (4 digits, no 00)
    console.log('--- Testing type=stock ---');
    const res1 = await fetch(baseUrl + '?stock_types=stock&limit=3');
    const json1 = await res1.json();
    console.log('Total:', json1.total);
    json1.data.forEach(d => console.log(`  ${d.symbol} ${d.name}`));

    // Test 2: ETFs (starts with 00)
    console.log('\n--- Testing type=etf ---');
    const res2 = await fetch(baseUrl + '?stock_types=etf&limit=5');
    const json2 = await res2.json();
    console.log('Total:', json2.total);
    json2.data.forEach(d => console.log(`  ${d.symbol} ${d.name}`));

    // Test 3: Warrants (6 digits, no 00)
    console.log('\n--- Testing type=warrant ---');
    const res3 = await fetch(baseUrl + '?stock_types=warrant&limit=3');
    const json3 = await res3.json();
    console.log('Total:', json3.total);
    json3.data.forEach(d => console.log(`  ${d.symbol} ${d.name}`));

    // Test 4: Multiple types
    console.log('\n--- Testing type=stock,etf ---');
    const res4 = await fetch(baseUrl + '?stock_types=stock,etf&limit=3');
    const json4 = await res4.json();
    console.log('Total:', json4.total);
}
validate();
