const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// Load environment variables from the project's .env file
const envPath = '/home/xg/stock-screener/.env';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([^#\s][^=]*)\s*=\s*(.*)$/);
  if (match) {
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

const localConfig = {
  user: env.DB_USER || 'postgres',
  host: env.DB_HOST || 'localhost',
  database: env.DB_NAME || 'stock_screener',
  password: env.DB_PASSWORD || 'postgres123',
  port: parseInt(env.DB_PORT || '5533'),
};

const supabaseUrl = env.SUPABASE_URL || 'postgresql://postgres.gfwlifpmstidgudgojwe:HfSDHrdekEY0vLPz@aws-1-us-east-1.pooler.supabase.com:5432/postgres';

const localPool = new Pool(localConfig);
const remotePool = new Pool({
  connectionString: supabaseUrl,
  ssl: { rejectUnauthorized: false }
});

async function syncTable(tableName, query, columns) {
  console.log(`\n📦 Syncing ${tableName}...`);
  try {
    const totalRes = await localPool.query(`SELECT COUNT(*) FROM (${query}) as sub`);
    const totalRows = parseInt(totalRes.rows[0].count);
    console.log(`Total rows to sync: ${totalRows}`);

    const batchSize = 2000;
    let syncedRows = 0;

    for (let offset = 0; offset < totalRows; offset += batchSize) {
      const res = await localPool.query(`${query} LIMIT ${batchSize} OFFSET ${offset}`);
      const rows = res.rows;
      if (rows.length === 0) break;

      const placeholders = [];
      const values = [];
      let idx = 1;

      rows.forEach(row => {
        const rowPlaceholders = [];
        columns.forEach(col => {
          values.push(row[col]);
          rowPlaceholders.push(`$${idx++}`);
        });
        placeholders.push(`(${rowPlaceholders.join(',')})`);
      });

      const insertSql = `INSERT INTO ${tableName} (${columns.join(',')}) VALUES ${placeholders.join(',')} ON CONFLICT DO NOTHING`;
      try {
        await remotePool.query(insertSql, values);
      } catch (batchErr) {
        console.error(`\n❌ Error in batch ${offset}-${offset+batchSize}:`, batchErr.message);
        // Continue to see if other batches work, or throw if it's a fatal connection error
        if (batchErr.message.includes('connection') || batchErr.message.includes('terminated')) {
           throw batchErr;
        }
      }
      
      syncedRows += rows.length;
      process.stdout.write(`\rProgress: ${syncedRows}/${totalRows} (${Math.round(syncedRows/totalRows*100)}%)`);
    }
    console.log(`\n✅ ${tableName} synced successfully.`);
  } catch (err) {
    console.error(`\n❌ Error syncing ${tableName}:`, err.message);
  }
}

async function run() {
  try {
    // 1. Stocks
    await syncTable('stocks', 
      "SELECT symbol, name, market, industry, updated_at, stock_type, listing_date FROM stocks WHERE (symbol ~ '^\\d{4}$' OR symbol ~ '^00.*')",
      ['symbol', 'name', 'market', 'industry', 'updated_at', 'stock_type', 'listing_date']
    );

    // 2. Health Scores
    await syncTable('stock_health_scores',
      `SELECT shs.id, shs.symbol, shs.name, shs.industry, shs.market, shs.close_price, shs.change_percent, shs.overall_score, shs.grade, shs.grade_color, shs.profit_score, shs.growth_score, shs.safety_score, shs.value_score, shs.dividend_score, shs.chip_score, shs.pe, shs.pb, shs.dividend_yield, shs.roe, shs.gross_margin, shs.revenue_growth, shs.eps_growth, shs.avg_cash_dividend, shs.inst_net_buy, shs.calc_date, shs.created_at, shs.smart_score, shs.smart_rating 
       FROM stock_health_scores shs JOIN stocks s ON shs.symbol = s.symbol WHERE (s.symbol ~ '^\\d{4}$' OR s.symbol ~ '^00.*')`,
      ['id', 'symbol', 'name', 'industry', 'market', 'close_price', 'change_percent', 'overall_score', 'grade', 'grade_color', 'profit_score', 'growth_score', 'safety_score', 'value_score', 'dividend_score', 'chip_score', 'pe', 'pb', 'dividend_yield', 'roe', 'gross_margin', 'revenue_growth', 'eps_growth', 'avg_cash_dividend', 'inst_net_buy', 'calc_date', 'created_at', 'smart_score', 'smart_rating']
    );

    // 3. Daily Prices (The Big One)
    await syncTable('daily_prices',
      `SELECT id, symbol, trade_date, open_price, high_price, low_price, close_price, change_amount, change_percent, volume, trade_value, transactions, created_at, pe, pb, dividend_yield 
       FROM daily_prices WHERE trade_date >= CURRENT_DATE - INTERVAL '3 years' AND (symbol ~ '^\\d{4}$' OR symbol ~ '^00.*')`,
      ['id', 'symbol', 'trade_date', 'open_price', 'high_price', 'low_price', 'close_price', 'change_amount', 'change_percent', 'volume', 'trade_value', 'transactions', 'created_at', 'pe', 'pb', 'dividend_yield']
    );

    // 4. Fundamentals
    await syncTable('fundamentals',
      `SELECT id, symbol, trade_date, pe_ratio, dividend_yield, pb_ratio, created_at 
       FROM fundamentals WHERE trade_date >= CURRENT_DATE - INTERVAL '3 years' AND (symbol ~ '^\\d{4}$' OR symbol ~ '^00.*')`,
      ['id', 'symbol', 'trade_date', 'pe_ratio', 'dividend_yield', 'pb_ratio', 'created_at']
    );

    // 5. Total Institutional
    await syncTable('fm_total_institutional',
      `SELECT date, name, buy, sell FROM fm_total_institutional WHERE date >= CURRENT_DATE - INTERVAL '3 years'`,
      ['date', 'name', 'buy', 'sell']
    );

    // 6. Total Margin
    await syncTable('fm_total_margin',
      `SELECT date, name, margin_purchase_buy, margin_purchase_sell, margin_purchase_cash_repayment, margin_purchase_yesterday_balance, margin_purchase_today_balance, short_sale_buy, short_sale_sell, short_sale_cash_repayment, short_sale_yesterday_balance, short_sale_today_balance 
       FROM fm_total_margin WHERE date >= CURRENT_DATE - INTERVAL '3 years'`,
      ['date', 'name', 'margin_purchase_buy', 'margin_purchase_sell', 'margin_purchase_cash_repayment', 'margin_purchase_yesterday_balance', 'margin_purchase_today_balance', 'short_sale_buy', 'short_sale_sell', 'short_sale_cash_repayment', 'short_sale_yesterday_balance', 'short_sale_today_balance']
    );

  } catch (err) {
    console.error('Fatal Error:', err.message);
  } finally {
    await localPool.end();
    await remotePool.end();
  }
}

run();
