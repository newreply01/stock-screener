const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { query } = require('./db');

async function analyzeStocks() {
  try {
    // 取得所有不包含英文字母的 symbol
    const res = await query("SELECT symbol, name, market, industry, stock_type FROM stocks WHERE symbol !~ '[A-Za-z]'");
    const stocks = res.rows;
    
    console.log(`總筆數: ${stocks.length}`);
    
    // 依據字串長度分組
    const lengthGroups = {};
    for (const stock of stocks) {
      const len = stock.symbol.length;
      if (!lengthGroups[len]) {
        lengthGroups[len] = {
          count: 0,
          samples: []
        };
      }
      lengthGroups[len].count++;
      if (lengthGroups[len].samples.length < 5) {
        lengthGroups[len].samples.push(`${stock.symbol} (${stock.name} - ${stock.market||'N/A'} - ${stock.industry||'N/A'})`);
      }
    }
    
    // 印出結果
    const lengths = Object.keys(lengthGroups).sort((a, b) => Number(a) - Number(b));
    console.log('\n--- 代號長度分佈 ---');
    for (const len of lengths) {
      console.log(`長度 ${len} 碼: 共 ${lengthGroups[len].count} 筆`);
      console.log(`  範例:`);
      for (const sample of lengthGroups[len].samples) {
        console.log(`    - ${sample}`);
      }
    }

    // 依據 market 分組
    const marketGroups = {};
    for (const stock of stocks) {
      const mt = stock.market || 'Unknown';
      marketGroups[mt] = (marketGroups[mt] || 0) + 1;
    }

    console.log('\n--- 市場類型 (market) 分佈 ---');
    for (const [mt, count] of Object.entries(marketGroups)) {
      console.log(`${mt}: 共 ${count} 筆`);
    }

    // 依據 industry 分組
    const indGroups = {};
    for (const stock of stocks) {
      const ind = stock.industry || 'Unknown';
      indGroups[ind] = (indGroups[ind] || 0) + 1;
    }

    console.log('\n--- 產業類別 (industry) 分佈 ---');
    // sort by count
    const sortedInds = Object.entries(indGroups).sort((a,b) => b[1] - a[1]);
    for (const [ind, count] of sortedInds) {
      console.log(`${ind}: 共 ${count} 筆`);
    }

  } catch(err) {
      console.error(err);
  } finally {
      process.exit(0);
  }
}

analyzeStocks();
