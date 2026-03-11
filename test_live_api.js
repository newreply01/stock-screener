const fetch = globalThis.fetch || require('node-fetch');

async function test() {
    try {
        console.log("Testing /api/institutional-rank...");
        const res = await fetch("http://127.0.0.1:3005/api/institutional-rank");
        const json = await res.json();
        console.log("Status:", res.status);
        if (json.data) console.log(`Got ${json.data.length} records.`);
        else console.log(json);
        
        console.log("\nTesting /api/stock/2330/institutional...");
        const res2 = await fetch("http://127.0.0.1:3005/api/stock/2330/institutional");
        const json2 = await res2.json();
        console.log("Status:", res2.status);
        console.log(`Got ${json2.length} records.`);
        if (json2.length > 0) console.log(json2[0]);
        else console.log("Empty result.");
        
        console.log("\nTesting /api/market-margin...");
        const res3 = await fetch("http://127.0.0.1:3005/api/market-margin");
        const json3 = await res3.json();
        console.log("Status:", res3.status);
        if (json3.data) console.log(`Got ${json3.data.length} records.`);
        if (json3.data?.length > 0) console.log(json3.data[json3.data.length - 1]);
    } catch(e) {
        console.error(e);
    }
}
test();
