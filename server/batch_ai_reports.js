const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { query } = require('./db');
const { generateAIReport } = require('./utils/ai_service');

async function batchGenerate() {
  console.log('Starting batch AI report generation for top 100 stocks by volume...');
  
  try {
    // 1. Get latest trade date
    const dateRes = await query(`
      SELECT MAX(trade_date) as latest_date 
      FROM daily_prices 
      WHERE volume > 0
    `);
    const latestDate = dateRes.rows[0].latest_date;
    console.log(`Latest trade date: ${latestDate.toISOString().split('T')[0]}`);

    // 2. Get top 100 stocks by volume
    const stocksRes = await query(`
      SELECT symbol, volume 
      FROM daily_prices 
      WHERE trade_date = $1 
      AND symbol ~ '^[0-9]{4}$' -- Only main stocks
      ORDER BY volume DESC 
      LIMIT 100
    `, [latestDate]);
    
    const stocks = stocksRes.rows;
    console.log(`Found ${stocks.length} stocks to process.`);

    // 3. Process in batches to avoid overwhelming the API/DB
    const BATCH_SIZE = 5;
    for (let i = 0; i < stocks.length; i += BATCH_SIZE) {
      const currentBatch = stocks.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(stocks.length / BATCH_SIZE)}...`);
      
      const promises = currentBatch.map(async (stock) => {
        const symbol = stock.symbol;
        console.log(`  Generating report for ${symbol}...`);
        const result = await generateAIReport(symbol);
        if (result.success) {
          console.log(`  Successfully generated report for ${symbol}`);
        } else {
          console.error(`  Failed to generate report for ${symbol}:`, result.error);
        }
      });
      
      await Promise.all(promises);
      
      // Optional: small delay between batches
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('Batch generation completed!');
  } catch (err) {
    console.error('Batch generation error:', err);
  } finally {
    process.exit(0);
  }
}

batchGenerate();
