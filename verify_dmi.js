const { ADX } = require('technicalindicators');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: 'xg',
    host: 'localhost',
    database: 'stock_screener',
    password: 'postgres123',
    port: 5432,
});

async function verifyDMI(symbol) {
    try {
        const query = `
            SELECT 
                trade_date, high_price as high, low_price as low, close_price as close
            FROM daily_prices
            WHERE symbol = $1
            ORDER BY trade_date ASC
        `;
        const res = await pool.query(query, [symbol]);
        const rows = res.rows;

        if (rows.length < 30) {
            console.log("Insufficient data: " + rows.length);
            return;
        }

        const input = {
            high: rows.map(r => parseFloat(r.high)),
            low: rows.map(r => parseFloat(r.low)),
            close: rows.map(r => parseFloat(r.close)),
            period: 14
        };

        const results = ADX.calculate(input);
        const latestIdx = results.length - 1;
        const latest = results[latestIdx];
        const latestDate = rows[rows.length - 1].trade_date;

        console.log(`Verification for ${symbol} on ${latestDate.toISOString().split('T')[0]}:`);
        console.log(`ADX: ${latest.adx.toFixed(2)}`);
        console.log(`+DI (PDI): ${latest.pdi.toFixed(2)}`);
        console.log(`-DI (MDI): ${latest.mdi.toFixed(2)}`);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

verifyDMI('2330');
