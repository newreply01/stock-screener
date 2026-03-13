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
        const symbols = ['2330', '2317', '2454', '2308', '2881'];
        for (const symbol of symbols) {
            const res = await pool.query(`
                SELECT trade_date as time, open_price, high_price, low_price, close_price, volume
                FROM daily_prices_2025
                WHERE symbol = $1
                ORDER BY trade_date DESC
                LIMIT 10
            `, [symbol]);

            if (res.rows.length < 5) continue;

            // reverse to chronological order
            const candleData = res.rows.reverse().map(r => ({
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

            const latestIdx = candleData.length - 1;
            const input5 = {
                open: opens.slice(latestIdx - 4, latestIdx + 1),
                high: highs.slice(latestIdx - 4, latestIdx + 1),
                low: lows.slice(latestIdx - 4, latestIdx + 1),
                close: closes.slice(latestIdx - 4, latestIdx + 1)
            };

            const patterns = [];
            if (bullishengulfingpattern(input5)) patterns.push('Bullish Engulfing');
            if (bearishengulfingpattern(input5)) patterns.push('Bearish Engulfing');
            if (bullishhammerstick(input5)) patterns.push('Hammer');
            if (hangingman(input5)) patterns.push('Hanging Man');
            
            console.log(`Symbol ${symbol} (Latest: ${candleData[latestIdx].time.toISOString().split('T')[0]}): ${patterns.length > 0 ? patterns.join(', ') : 'No pattern in last 5 days'}`);
        }
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

main();
