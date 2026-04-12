const { Pool } = require('pg');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: 'localhost',
  database: 'stock_screener',
  password: process.env.DB_PASSWORD || 'postgres123',
  port: parseInt(process.env.DB_PORT || '5533'),
});

const dumpPath = '/home/xg/stock-screener/refined_slim_v2.sql';

async function run() {
  try {
    const dbName = process.env.DB_NAME || 'stock_screener';
    const dbUser = process.env.DB_USER || 'postgres';
    const dbPass = process.env.DB_PASSWORD || 'postgres123';
    const dbPort = process.env.DB_PORT || '5533';

    console.log('🚀 [Slim-Clean-SQL] 開始產生雲端純淨版 SQL 備份...');

    // 1. 取得最新交易日
    const latestTickerDayRes = await pool.query("SELECT MAX(trade_time) as last_time FROM realtime_ticks");
    const lastTime = latestTickerDayRes.rows[0].last_time;
    let lastDayStr = null;
    if (lastTime) {
        const tpeDate = new Date(new Date(lastTime).getTime() + 8 * 3600 * 1000);
        lastDayStr = tpeDate.toISOString().split('T')[0];
    }
    console.log(`📅 最新交易日: ${lastDayStr}`);

    // 2. 建立純淨 Schema (避開 pg_dump 生成的複雜 SET 與 \restrict)
    console.log('🏗️  正在導出表結構...');
    fs.writeFileSync(dumpPath, `
-- Cloud-Clean SQL Dump
-- Re-initializing tables instead of dropping schema (Supabase compatibility)
SET session_replication_role = 'replica';

DROP TABLE IF EXISTS public.realtime_ticks CASCADE;
DROP TABLE IF EXISTS public.fm_total_margin CASCADE;
DROP TABLE IF EXISTS public.fm_total_institutional CASCADE;
DROP TABLE IF EXISTS public.fundamentals CASCADE;
DROP TABLE IF EXISTS public.daily_prices CASCADE;
DROP TABLE IF EXISTS public.ai_reports CASCADE;
DROP TABLE IF EXISTS public.stock_health_scores CASCADE;
DROP TABLE IF EXISTS public.ai_prompt_templates CASCADE;
DROP TABLE IF EXISTS public.stocks CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.ai_generation_queue CASCADE;
DROP TABLE IF EXISTS public.ai_reports_history CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.brokers CASCADE;
DROP TABLE IF EXISTS public.corp_events CASCADE;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public;
\n`);
    
    // 使用簡單的 schema 導出，並過濾掉所有系統 SET 指令
    const tempSchema = '/tmp/raw_schema.sql';
    execSync(`PGPASSWORD='${dbPass}' pg_dump -h localhost -p ${dbPort} -U ${dbUser} -d ${dbName} --schema-only --no-owner --no-privileges --no-comments > ${tempSchema}`);
    
    // 過濾掉 pg_dump 生成的系統參數 (SET, SELECT pg_catalog, \restrict 等)
    const cleanSchema = execSync(`grep -vE '^(SET|SELECT pg_catalog|\\\\)' ${tempSchema}`).toString();
    fs.appendFileSync(dumpPath, cleanSchema);
    fs.unlinkSync(tempSchema);

    // 3. 數據導出
    const appendTableData = async (tableName, columns, queryStr) => {
        console.log(`📦 正在導出 ${tableName}...`);
        const tmpFile = `/tmp/data_${tableName}.tmp`;
        const copyCmd = `PGPASSWORD='${dbPass}' psql -h localhost -p ${dbPort} -U ${dbUser} -d ${dbName} -c "COPY (${queryStr}) TO STDOUT" > ${tmpFile}`;
        execSync(copyCmd);
        
        fs.appendFileSync(dumpPath, `\n\n-- Data for ${tableName}\nCOPY public.${tableName} (${columns}) FROM stdin;\n`);
        const data = fs.readFileSync(tmpFile);
        fs.appendFileSync(dumpPath, data);
        fs.appendFileSync(dumpPath, "\\.\n");
        fs.unlinkSync(tmpFile);
    };

    const symbolFilter = "(symbol ~ '^\\d{4}$' OR symbol ~ '^00.*')";
    const dateLimit = "trade_date >= CURRENT_DATE - INTERVAL '2.5 years'";

    await appendTableData('users', 'id, email, password_hash, name, avatar_url, provider, provider_id, created_at, updated_at', 'SELECT id, email, password_hash, name, avatar_url, provider, provider_id, created_at, updated_at FROM users');
    await appendTableData('stocks', 'symbol, name, market, industry, updated_at, stock_type, listing_date', `SELECT symbol, name, market, industry, updated_at, stock_type, listing_date FROM stocks WHERE ${symbolFilter}`);
    await appendTableData('ai_prompt_templates', 'id, name, content, version, is_active, created_at, note', 'SELECT id, name, content, version, is_active, created_at, note FROM ai_prompt_templates');
    await appendTableData('stock_health_scores', 'id, symbol, name, industry, market, close_price, change_percent, overall_score, grade, grade_color, profit_score, growth_score, safety_score, value_score, dividend_score, chip_score, pe, pb, dividend_yield, roe, gross_margin, revenue_growth, eps_growth, avg_cash_dividend, inst_net_buy, calc_date, created_at, smart_score, smart_rating', `SELECT id, symbol, name, industry, market, close_price, change_percent, overall_score, grade, grade_color, profit_score, growth_score, safety_score, value_score, dividend_score, chip_score, pe, pb, dividend_yield, roe, gross_margin, revenue_growth, eps_growth, avg_cash_dividend, inst_net_buy, calc_date, created_at, smart_score, smart_rating FROM stock_health_scores WHERE symbol IN (SELECT symbol FROM stocks WHERE ${symbolFilter})`);
    await appendTableData('ai_reports', 'symbol, content, sentiment_score, created_at, updated_at, report_date', `SELECT ar.symbol, ar.content, ar.sentiment_score, ar.created_at, ar.updated_at, ar.report_date FROM ai_reports ar JOIN stocks s ON ar.symbol = s.symbol WHERE (ar.symbol ~ '^\\d{4}$' OR ar.symbol ~ '^00.*') AND ar.report_date = (SELECT MAX(report_date) FROM ai_reports WHERE symbol = ar.symbol)`);
    await appendTableData('daily_prices', 'id, symbol, trade_date, open_price, high_price, low_price, close_price, change_amount, change_percent, volume, trade_value, transactions, created_at, pe, pb, dividend_yield', `SELECT id, symbol, trade_date, open_price, high_price, low_price, close_price, change_amount, change_percent, volume, trade_value, transactions, created_at, pe, pb, dividend_yield FROM daily_prices WHERE ${dateLimit} AND ${symbolFilter}`);
    await appendTableData('fundamentals', 'id, symbol, trade_date, pe_ratio, dividend_yield, pb_ratio, created_at', `SELECT id, symbol, trade_date, pe_ratio, dividend_yield, pb_ratio, created_at FROM fundamentals WHERE ${dateLimit} AND ${symbolFilter}`);
    await appendTableData('fm_total_institutional', 'date, name, buy, sell', "SELECT date, name, buy, sell FROM fm_total_institutional WHERE date >= CURRENT_DATE - INTERVAL '2.5 years'");
    await appendTableData('fm_total_margin', 'date, name, margin_purchase_buy, margin_purchase_sell, margin_purchase_cash_repayment, margin_purchase_yesterday_balance, margin_purchase_today_balance, short_sale_buy, short_sale_sell, short_sale_cash_repayment, short_sale_yesterday_balance, short_sale_today_balance', "SELECT date, name, margin_purchase_buy, margin_purchase_sell, margin_purchase_cash_repayment, margin_purchase_yesterday_balance, margin_purchase_today_balance, short_sale_buy, short_sale_sell, short_sale_cash_repayment, short_sale_yesterday_balance, short_sale_today_balance FROM fm_total_margin WHERE date >= CURRENT_DATE - INTERVAL '2.5 years'");

    if (lastDayStr) {
        await appendTableData('realtime_ticks', 'id, symbol, trade_time, price, open_price, high_price, low_price, volume, trade_volume, buy_intensity, sell_intensity, five_levels, created_at, previous_close', `SELECT id, symbol, trade_time, price, open_price, high_price, low_price, volume, trade_volume, buy_intensity, sell_intensity, five_levels, created_at, previous_close FROM realtime_ticks WHERE DATE(trade_time) = '${lastDayStr}' AND ${symbolFilter}`);
    }

    // 4. 重置環境
    fs.appendFileSync(dumpPath, "\nSET session_replication_role = 'origin';\n");

    console.log(`\n✅ 純淨版備份完成: ${dumpPath}`);
    const stats = execSync(`ls -lh ${dumpPath}`).toString();
    console.log(stats);

  } catch (err) {
    console.error('❌ 發生錯誤:', err);
  } finally {
    await pool.end();
  }
}

run();
