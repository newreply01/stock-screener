const { query, end } = require('./db');
const ti = require('technicalindicators');

const safeCheck = (fn, input) => { try { return fn(input); } catch (e) { return false; } };

async function testPatterns() {
    try {
        const res = await query(
            "SELECT trade_date, open_price, high_price, low_price, close_price FROM daily_prices WHERE symbol='2330' ORDER BY trade_date ASC"
        );
        const rows = res.rows;
        const closes = rows.map(r => parseFloat(r.close_price));
        const opens = rows.map(r => parseFloat(r.open_price));
        const highs = rows.map(r => parseFloat(r.high_price));
        const lows = rows.map(r => parseFloat(r.low_price));

        console.log('Total rows:', rows.length);
        console.log('Last 10 days:');
        rows.slice(-10).forEach(r => console.log(' ', r.trade_date.toISOString().slice(0, 10), 'O=' + r.open_price, 'H=' + r.high_price, 'L=' + r.low_price, 'C=' + r.close_price));

        console.log('\nPattern detection (last 10 candles with 5-candle window):');
        for (let i = Math.max(4, rows.length - 10); i < rows.length; i++) {
            const input5 = {
                open: opens.slice(i - 4, i + 1),
                high: highs.slice(i - 4, i + 1),
                low: lows.slice(i - 4, i + 1),
                close: closes.slice(i - 4, i + 1)
            };
            const date = rows[i].trade_date.toISOString().slice(0, 10);
            const found = [];
            if (safeCheck(ti.bullishengulfingpattern, input5)) found.push('bullish_engulfing');
            if (safeCheck(ti.bearishengulfingpattern, input5)) found.push('bearish_engulfing');
            if (safeCheck(ti.bullishhammerstick, input5)) found.push('hammer');
            if (safeCheck(ti.hangingman, input5)) found.push('hanging_man');
            if (safeCheck(ti.morningstar, input5)) found.push('morning_star');
            if (safeCheck(ti.eveningstar, input5)) found.push('evening_star');
            if (safeCheck(ti.threewhitesoldiers, input5)) found.push('red_three_soldiers');
            if (safeCheck(ti.threeblackcrows, input5)) found.push('three_black_crows');
            if (safeCheck(ti.piercingline, input5)) found.push('piercing_line');
            console.log(' ', date + ':', found.length > 0 ? found.join(', ') : '(none)');
        }
    } catch (e) {
        console.error(e);
    } finally {
        end();
    }
}
testPatterns();
