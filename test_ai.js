const { generateAIReport } = require('./server/utils/ai_service');
const symbol = process.argv[2] || '2330';
console.log('Testing AI Report for:', symbol);
generateAIReport(symbol)
  .then(res => {
    console.log(JSON.stringify({
      success: res.success,
      symbol: res.symbol,
      generationMode: res.generationMode,
      sentimentScore: res.sentimentScore,
      contentPreview: res.content ? res.content.substring(0, 200) + '...' : null
    }, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error('Test Failed:', err);
    process.exit(1);
  });
