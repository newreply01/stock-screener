const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function test() {
    try {
        const res = await fetch('http://localhost:3000/api/screen?limit=5');
        const json = await res.json();
        console.log('API Response Sample (First 2 items):');
        if (json.data && json.data.length > 0) {
            console.log(JSON.stringify(json.data.slice(0, 2), null, 2));
            console.log('Total Results:', json.total);

            const symbols = json.data.map(d => d.symbol);
            const uniqueSymbols = new Set(symbols);
            if (symbols.length !== uniqueSymbols.size) {
                console.warn('⚠️ DUPLICATES DETECTED IN API RESPONSE!');
                const counts = {};
                symbols.forEach(s => counts[s] = (counts[s] || 0) + 1);
                console.log('Counts:', counts);
            } else {
                console.log('✅ No duplicates in this sample.');
            }
        } else {
            console.log('No data returned.');
        }
    } catch (e) {
        console.error('Fetch failed:', e.message);
    }
}

test();
