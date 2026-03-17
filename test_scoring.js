const { calculateScores } = require('./server/utils/factor_scoring_service');

async function test() {
    const symbol = '2330';
    console.log(`Testing 7-Factor Scoring for ${symbol}...`);
    const scores = await calculateScores(symbol);
    console.log('Results:', JSON.stringify(scores, null, 2));
    process.exit(0);
}
test();
