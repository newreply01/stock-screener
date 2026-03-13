const { pool } = require('./server/db');
const {
    bullishengulfingpattern,
    bearishengulfingpattern,
    bullishhammerstick,
    hangingman,
    morningstar,
    eveningstar,
    threewhitesoldiers,
    threeblackcrows,
    piercingline
} = require('technicalindicators');

async function main() {
    try {
        // Fetch last 100 days of 2330
        const res = await pool.query(`
            SELECT trade_date as time, open_price, high_price, low_price, close_price, volume
            FROM daily_prices_2025
            WHERE symbol = '2330'
            ORDER BY trade_date ASC
            LIMIT 100
        `);

        if (res.rows.length === 0) {
            console.log('No data found for 2330 in 2025 table.');
            return;
        }

        const candleData = res.rows.map(r => ({
            time: r.time,
            open: parseFloat(r.open_price),
            high: parseFloat(r.high_price),
            low: parseFloat(r.low_price),
            close: parseFloat(r.close_price)
        }));

        const opens = candleData.map(d => d.open);
        const highs = candleData.map(d => d.high);
        const lows = candleData.map(d => d.low);
        const closes = candleData.map(d => d.close);

        console.log(`Analyzing ${candleData.length} bars for 2330...`);

        const safeCheck = (fn, input) => {
            try { return fn(input); } catch (e) { return false; }
        };

        for (let i = 4; i < candleData.length; i++) {
            const input5 = {
                open: opens.slice(i - 4, i + 1),
                high: highs.slice(i - 4, i + 1),
                low: lows.slice(i - 4, i + 1),
                close: closes.slice(i - 4, i + 1)
            };

            const patterns = [];
            if (safeCheck(bullishengulfingpattern, input5)) patterns.push('Bullish Engulfing');
            if (safeCheck(bearishengulfingpattern, input5)) patterns.push('Bearish Engulfing');
            if (safeCheck(bullishhammerstick, input5)) patterns.push('Hammer');
            if (safeCheck(hangingman, input5)) patterns.push('Hanging Man');
            if (safeCheck(morningstar, input5)) patterns.push('Morning Star');
            if (safeCheck(eveningstar, input5)) patterns.push('Evening Star');

            if (patterns.length > 0) {
                console.log(`[${candleData[i].time}] Patterns: ${patterns.join(', ')}`);
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

main();
