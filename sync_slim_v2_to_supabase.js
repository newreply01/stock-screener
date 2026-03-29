const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// Load environment variables
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

const supabaseUrl = env.SUPABASE_URL;

const localPool = new Pool(localConfig);
const remotePool = new Pool({
  connectionString: supabaseUrl,
  ssl: { rejectUnauthorized: false }
});

async function syncTable(tableName, query, columns, conflictClause) {
  console.log(`\n📦 Syncing ${tableName}...`);
  try {
    const totalRes = await localPool.query(`SELECT COUNT(*) FROM (${query}) as sub`);
    const totalRows = parseInt(totalRes.rows[0].count);
    console.log(`Total rows to sync: ${totalRows}`);

    const batchSize = 1000;
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

      const insertSql = `
        INSERT INTO ${tableName} (${columns.join(',')}) 
        VALUES ${placeholders.join(',')} 
        ON CONFLICT ${conflictClause}
      `;
      
      try {
        await remotePool.query(insertSql, values);
      } catch (batchErr) {
        console.error(`\n❌ Error in batch ${offset}-${offset+batchSize}: ${batchErr.message}`);
      }
      
      syncedRows += rows.length;
      process.stdout.write(`\rProgress: ${syncedRows}/${totalRows} (${Math.round(syncedRows/totalRows*100)}%)`);
    }
    console.log(`\n✅ ${tableName} synced.`);
  } catch (err) {
    console.error(`\n❌ Error syncing ${tableName}:`, err.message);
  }
}

async function run() {
  try {
    console.log('🚀 Starting Slim-V2 Sync to Supabase...');

    // 1. Stocks
    await syncTable('stocks', 
      "SELECT symbol, name, market, industry, updated_at, stock_type, listing_date FROM stocks WHERE (symbol ~ '^\\d{4}$' OR symbol ~ '^00.*')",
      ['symbol', 'name', 'market', 'industry', 'updated_at', 'stock_type', 'listing_date'],
      "(symbol) DO UPDATE SET name=EXCLUDED.name, market=EXCLUDED.market, industry=EXCLUDED.industry, updated_at=EXCLUDED.updated_at"
    );

    // 2. AI Templates
    await syncTable('ai_prompt_templates', 
      "SELECT id, name, content, version, is_active, created_at, note FROM ai_prompt_templates",
      ['id', 'name', 'content', 'version', 'is_active', 'created_at', 'note'],
      "(id) DO UPDATE SET content=EXCLUDED.content, version=EXCLUDED.version, is_active=EXCLUDED.is_active"
    );

    // 3. Health Scores
    await syncTable('stock_health_scores',
      `SELECT shs.* FROM stock_health_scores shs JOIN stocks s ON shs.symbol = s.symbol WHERE (s.symbol ~ '^\\d{4}$' OR s.symbol ~ '^00.*') AND shs.calc_date >= CURRENT_DATE - INTERVAL '7 days'`,
      ['symbol', 'name', 'industry', 'market', 'close_price', 'change_percent', 'overall_score', 'grade', 'grade_color', 'profit_score', 'growth_score', 'safety_score', 'value_score', 'dividend_score', 'chip_score', 'pe', 'pb', 'dividend_yield', 'roe', 'gross_margin', 'revenue_growth', 'eps_growth', 'avg_cash_dividend', 'inst_net_buy', 'calc_date', 'created_at', 'smart_score', 'smart_rating'],
      "(symbol, calc_date) DO UPDATE SET overall_score=EXCLUDED.overall_score, grade=EXCLUDED.grade, smart_rating=EXCLUDED.smart_rating"
    );

    // 4. AI Reports
    await syncTable('ai_reports',
      `SELECT ar.* FROM ai_reports ar JOIN stocks s ON ar.symbol = s.symbol WHERE (s.symbol ~ '^\\d{4}$' OR s.symbol ~ '^00.*')`,
      ['symbol', 'content', 'sentiment_score', 'updated_at'],
      "(symbol) DO UPDATE SET content=EXCLUDED.content, sentiment_score=EXCLUDED.sentiment_score, updated_at=EXCLUDED.updated_at"
    );

    // 5. Daily Prices (2.5 years)
    await syncTable('daily_prices',
      `SELECT id, symbol, trade_date, open_price, high_price, low_price, close_price, change_amount, change_percent, volume, trade_value, transactions, created_at, pe, pb, dividend_yield 
       FROM daily_prices WHERE trade_date >= CURRENT_DATE - INTERVAL '2.5 years' AND (symbol ~ '^\\d{4}$' OR symbol ~ '^00.*')`,
      ['symbol', 'trade_date', 'open_price', 'high_price', 'low_price', 'close_price', 'change_amount', 'change_percent', 'volume', 'trade_value', 'transactions', 'created_at', 'pe', 'pb', 'dividend_yield'],
      "(symbol, trade_date) DO UPDATE SET close_price=EXCLUDED.close_price, volume=EXCLUDED.volume"
    );

    // 6. Fundamentals
    await syncTable('fundamentals',
      `SELECT id, symbol, trade_date, pe_ratio, dividend_yield, pb_ratio, created_at 
       FROM fundamentals WHERE trade_date >= CURRENT_DATE - INTERVAL '2.5 years' AND (symbol ~ '^\\d{4}$' OR symbol ~ '^00.*')`,
      ['symbol', 'trade_date', 'pe_ratio', 'dividend_yield', 'pb_ratio', 'created_at'],
      "(symbol, trade_date) DO UPDATE SET pe_ratio=EXCLUDED.pe_ratio, dividend_yield=EXCLUDED.dividend_yield"
    );

    // 7. Macros
    await syncTable('fm_total_institutional',
      `SELECT date, name, buy, sell FROM fm_total_institutional WHERE date >= CURRENT_DATE - INTERVAL '2.5 years'`,
      ['date', 'name', 'buy', 'sell'],
      "(date, name) DO UPDATE SET buy=EXCLUDED.buy, sell=EXCLUDED.sell"
    );

    // 8. Ticks (Today)
    const latestTickerDayRes = await localPool.query("SELECT MAX(trade_time) as last_time FROM realtime_ticks");
    const lastTime = latestTickerDayRes.rows[0].last_time;
    if (lastTime) {
        const tpeDate = new Date(new Date(lastTime).getTime() + 8 * 3600 * 1000);
        const lastDayStr = tpeDate.toISOString().split('T')[0];
        console.log(`\n🕒 Syncing Ticks for ${lastDayStr}...`);
        await syncTable('realtime_ticks',
            `SELECT * FROM realtime_ticks WHERE DATE(trade_time) = '${lastDayStr}' AND (symbol ~ '^\\d{4}$' OR symbol ~ '^00.*')`,
            ['symbol', 'trade_time', 'price', 'open_price', 'high_price', 'low_price', 'volume', 'trade_volume', 'buy_intensity', 'sell_intensity', 'five_levels', 'created_at', 'previous_close'],
            "(symbol, trade_time) DO UPDATE SET price=EXCLUDED.price, volume=EXCLUDED.volume"
        );
    }

    console.log('\n✨ Slim-V2 Sync Complete!');
  } catch (err) {
    console.error('\n❌ Fatal Error:', err.message);
  } finally {
    await localPool.end();
    await remotePool.end();
  }
}

run();
