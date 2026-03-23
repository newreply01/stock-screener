const fetch = require('node-fetch');

async function test() {
  const url = 'http://localhost:31000/api/stocks/compare?symbols=2330,2412';
  try {
    console.log(`Testing API: ${url}`);
    const res = await fetch(url);
    const data = await res.json();
    console.log('Success:', data.success);
    if (data.success && data.data.length > 0) {
      console.log('Data count:', data.data.length);
      console.log('First record sample:', JSON.stringify(data.data[0], null, 2));
    } else {
      console.log('Response:', JSON.stringify(data));
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
}
test();
