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

// Mock data for a Bullish Engulfing pattern
// Day 1: Red candle (Open > Close)
// Day 2: Green candle (Open < Close) that engulfs Day 1
const mockBullishEngulfing = {
    open:  [100, 90, 85, 80, 75],
    high:  [105, 95, 90, 85, 85],
    low:   [95,  85, 80, 75, 70],
    close: [98,  88, 82, 78, 82]
};

// Simplified 2-day version
const input2Bullish = {
    open: [80, 75],
    high: [85, 85],
    low: [75, 70],
    close: [78, 82]
};

console.log('Testing Bullish Engulfing (5 days):', bullishengulfingpattern(mockBullishEngulfing));
console.log('Testing Bullish Engulfing (2 days):', bullishengulfingpattern(input2Bullish));

// Mock Hammer
const inputHammer = {
    open: [100, 100, 100, 100, 100],
    high: [105, 105, 105, 105, 101],
    low: [95, 95, 95, 95, 90],
    close: [100, 100, 100, 100, 99.5]
};
console.log('Testing Hammer:', bullishhammerstick(inputHammer));
