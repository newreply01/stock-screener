const { Pool } = require('pg');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'stock_screener',
  password: process.env.DB_PASSWORD || 'postgres123',
  port: parseInt(process.env.DB_PORT || '5533'),
});

const dumpPath = '/home/xg/stock-screener/refined_slim_v2.sql';
const dbName = process.env.DB_NAME || 'stock_screener';
const dbUser = process.env.DB_USER || 'postgres';
const dbPass = process.env.DB_PASSWORD || 'postgres123';
const dbPort = process.env.DB_PORT || '5533';

async function run() {
  try {
    console.log('🚀 [Slim-V2] 開始產生精煉版資料庫備份...');

    // 1. 取得最新交易日 (用於 Ticks)
    const latestTickerDayRes = await pool.query("SELECT MAX(trade_time) as last_time FROM realtime_ticks");
    const lastTime = latestTickerDayRes.rows[0].last_time;
    // 使用台北時間解析日期
    let lastDayStr = null;
    if (lastTime) {
        // 如果是 Date 物件，轉換為 TPE 時間字串
        const tpeDate = new Date(new Date(lastTime).getTime() + 8 * 3600 * 1000);
        lastDayStr = tpeDate.toISOString().split('T')[0];
    }
    console.log(`📅 最新交易日 (TPE): ${lastDayStr}`);

    // 2. 導出 Schema 結構 (不含資料)
    console.log('🏗️  正在導出表結構...');
    // 首先寫入清空 Schema 的指令以及停用約束檢查的設定
    fs.writeFileSync(dumpPath, `
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Disable triggers and FK checks for faster/safer loading
SET session_replication_role = 'replica';
\n`);
    
    const schemaDumpCmd = `PGPASSWORD='${dbPass}' pg_dump -h localhost -p ${dbPort} -U ${dbUser} -d ${dbName} --schema-only --no-owner --no-privileges >> ${dumpPath}`;
    execSync(schemaDumpCmd);

    // 3. 準備大批量數據導出函式
    const appendTableData = async (tableName, columns, queryStr) => {
        console.log(`📦 正在導出 ${tableName}...`);
        const copyCmd = `PGPASSWORD='${dbPass}' psql -h localhost -p ${dbPort} -U ${dbUser} -d ${dbName} -c "COPY (${queryStr}) TO STDOUT WITH (FORMAT TEXT, ENCODING 'UTF8')" >> ${dumpPath}.tmp`;
        fs.appendFileSync(dumpPath, `\n\n-- Data for ${tableName}\nCOPY public.${tableName} (${columns}) FROM stdin;\n`);
        execSync(copyCmd);
        const data = fs.readFileSync(`${dumpPath}.tmp`);
        fs.appendFileSync(dumpPath, data);
        fs.appendFileSync(dumpPath, "\\.\n");
        fs.unlinkSync(`${dumpPath}.tmp`);
    };

    // 4. 定義過濾邏輯與欄位
    const symbolFilter = "(symbol ~ '^\\d{4}$' OR symbol ~ '^00.*')";
    const stockJoinFilter = "(s.symbol ~ '^\\d{4}$' OR s.symbol ~ '^00.*')";
    const dateLimit = "trade_date >= CURRENT_DATE - INTERVAL '2.5 years'";
    const priceDateLimit = "trade_date >= CURRENT_DATE - INTERVAL '2.5 years'";

    // 5. 執行各表導出
    
    // 行政/核心表
    await appendTableData('stocks', 'symbol, name, market, industry, updated_at, stock_type, listing_date', 
        `SELECT symbol, name, market, industry, updated_at, stock_type, listing_date FROM stocks WHERE ${symbolFilter}`);
    
    await appendTableData('ai_prompt_templates', 'id, name, content, version, is_active, created_at, note',
        `SELECT id, name, content, version, is_active, created_at, note FROM ai_prompt_templates`);
    
    await appendTableData('stock_health_scores', 'id, symbol, name, industry, market, close_price, change_percent, overall_score, grade, grade_color, profit_score, growth_score, safety_score, value_score, dividend_score, chip_score, pe, pb, dividend_yield, roe, gross_margin, revenue_growth, eps_growth, avg_cash_dividend, inst_net_buy, calc_date, created_at, smart_score, smart_rating',
        `SELECT shs.id, shs.symbol, shs.name, shs.industry, shs.market, shs.close_price, shs.change_percent, shs.overall_score, shs.grade, shs.grade_color, shs.profit_score, shs.growth_score, shs.safety_score, shs.value_score, shs.dividend_score, shs.chip_score, shs.pe, shs.pb, shs.dividend_yield, shs.roe, shs.gross_margin, shs.revenue_growth, shs.eps_growth, shs.avg_cash_dividend, shs.inst_net_buy, shs.calc_date, shs.created_at, shs.smart_score, shs.smart_rating FROM stock_health_scores shs JOIN stocks s ON shs.symbol = s.symbol WHERE ${stockJoinFilter}`);
    
    await appendTableData('ai_reports', 'symbol, content, sentiment_score, created_at, updated_at',
        `SELECT ar.symbol, ar.content, ar.sentiment_score, ar.created_at, ar.updated_at FROM ai_reports ar JOIN stocks s ON ar.symbol = s.symbol WHERE ${stockJoinFilter}`);
    
    // 歷史資料
    await appendTableData('daily_prices', 'id, symbol, trade_date, open_price, high_price, low_price, close_price, change_amount, change_percent, volume, trade_value, transactions, created_at, pe, pb, dividend_yield',
        `SELECT id, symbol, trade_date, open_price, high_price, low_price, close_price, change_amount, change_percent, volume, trade_value, transactions, created_at, pe, pb, dividend_yield FROM daily_prices WHERE ${priceDateLimit} AND ${symbolFilter}`);
    
    await appendTableData('fundamentals', 'id, symbol, trade_date, pe_ratio, dividend_yield, pb_ratio, created_at',
        `SELECT id, symbol, trade_date, pe_ratio, dividend_yield, pb_ratio, created_at FROM fundamentals WHERE ${dateLimit} AND ${symbolFilter}`);
    
    // 大盤彙總
    await appendTableData('fm_total_institutional', 'date, name, buy, sell',
        `SELECT date, name, buy, sell FROM fm_total_institutional WHERE date >= CURRENT_DATE - INTERVAL '2.5 years'`);
    
    await appendTableData('fm_total_margin', 'date, name, margin_purchase_buy, margin_purchase_sell, margin_purchase_cash_repayment, margin_purchase_yesterday_balance, margin_purchase_today_balance, short_sale_buy, short_sale_sell, short_sale_cash_repayment, short_sale_yesterday_balance, short_sale_today_balance',
        `SELECT date, name, margin_purchase_buy, margin_purchase_sell, margin_purchase_cash_repayment, margin_purchase_yesterday_balance, margin_purchase_today_balance, short_sale_buy, short_sale_sell, short_sale_cash_repayment, short_sale_yesterday_balance, short_sale_today_balance FROM fm_total_margin WHERE date >= CURRENT_DATE - INTERVAL '2.5 years'`);

    // Realtime Ticks
    if (lastDayStr) {
        console.log(`🕒 正在導出 ${lastDayStr} 的 Realtime Ticks...`);
        await appendTableData('realtime_ticks', 'id, symbol, trade_time, price, open_price, high_price, low_price, volume, trade_volume, buy_intensity, sell_intensity, five_levels, created_at, previous_close',
            `SELECT id, symbol, trade_time, price, open_price, high_price, low_price, volume, trade_volume, buy_intensity, sell_intensity, five_levels, created_at, previous_close FROM realtime_ticks WHERE DATE(trade_time) = '${lastDayStr}' AND ${symbolFilter}`);
    }

    // 6. 重設設定
    fs.appendFileSync(dumpPath, "\n-- Reset replication role\nSET session_replication_role = 'origin';\n");

    console.log(`\n✅ 備份完成: ${dumpPath}`);
    const stats = execSync(`ls -lh ${dumpPath}`).toString();
    console.log(stats);

  } catch (err) {
    console.error('❌ 發生錯誤:', err);
  } finally {
    await pool.end();
  }
}

run();
