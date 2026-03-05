const { Client } = require('pg');
const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'stock_screener',
    password: 'postgres123',
    port: 5432,
});

async function run() {
    await client.connect();
    try {
        console.log('--- Checking Market Indexes in daily_prices ---');
        const indexRes = await client.query(" SELECT symbol trade_date close_price FROM daily_prices WHERE symbol IN TAIEX TSE TWII IX0001 ORDER BY trade_date DESC LIMIT 10\);
