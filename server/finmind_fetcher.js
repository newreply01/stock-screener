// FinMind API Configuration and Token Management
// Note: FinMind has a rate limit of 600 calls per hour per token.
// Tokens can be configured in the .env file as FINMIND_TOKENS=token1,token2

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { pool } = require('./db');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const BASE_URL = 'https://api.finmindtrade.com/api/v4/data';
const TOKENS = (process.env.FINMIND_TOKENS || process.env.FINMIND_TOKEN || '')
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0);

const START_DATE = '2020-01-01'; // Default start date if not provided

let currentTokenIndex = 0;
function getCurrentToken() {
    if (TOKENS.length === 0) return null;
    return TOKENS[currentTokenIndex];
}
const exhaustedTokens = new Set(); // 記錄已耗盡額度的 token

function rotateToken(reason = '') {
    if (TOKENS.length <= 1) return false;
    exhaustedTokens.add(currentTokenIndex);
    // 找下一個尚未耗盡的 token
    for (let i = 1; i < TOKENS.length; i++) {
        const nextIndex = (currentTokenIndex + i) % TOKENS.length;
        if (!exhaustedTokens.has(nextIndex)) {
            currentTokenIndex = nextIndex;
            console.log(`🔄 [Token] 切換至 Token #${nextIndex + 1}/${TOKENS.length} (原因: ${reason})`);
            return true;
        }
    }
    console.error(`❌ [Token] 所有 ${TOKENS.length} 組 Token 額度皆已耗盡！`);
    return false;
}

function getTokenStatus() {
    const available = TOKENS.length - exhaustedTokens.size;
    return `🔑 [Token] 共 ${TOKENS.length} 組，可用 ${available} 組，目前使用 Token #${currentTokenIndex + 1}`;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchFinMind(dataset, data_id, start_date = START_DATE) {
    let url = `${BASE_URL}?dataset=${dataset}&data_id=${data_id}&start_date=${start_date}`;
    const token = getCurrentToken();
    if (token) {
        url += `&token=${token}`;
    }
    try {
        const res = await fetch(url);
        if (!res.ok) {
            if (res.status === 429) {
                console.warn(`⚠️ [FinMind] Rate limited on Token #${currentTokenIndex + 1}. Trying to rotate...`);
                if (rotateToken('HTTP 429 Rate Limited')) {
                    return fetchFinMind(dataset, data_id, start_date);
                }
                console.warn(`⚠️ [FinMind] 所有 Token 都被限速，等待 60s...`);
                await sleep(60000);
                exhaustedTokens.clear();
                return fetchFinMind(dataset, data_id, start_date);
            }
            if (res.status === 402) {
                console.warn(`⚠️ [FinMind] Token #${currentTokenIndex + 1} 額度耗盡 (HTTP 402)`);
                if (rotateToken('HTTP 402 Payment Required')) {
                    return fetchFinMind(dataset, data_id, start_date);
                }
                console.warn(`⚠️ [FinMind] 所有 ${TOKENS.length} 組 Token 額度皆已耗盡 (HTTP 402)，等待 60s 後重試...`);
                await sleep(60000);
                exhaustedTokens.clear();
                return fetchFinMind(dataset, data_id, start_date);
            }
            throw new Error(`HTTP ${res.status}`);
        }
        const json = await res.json();
        const data = json.data || [];
        return data;
    } catch (err) {
        console.error(`❌ [FinMind] Error fetching ${dataset} for ${data_id}:`, err.message);
        return [];
    }
}

async function syncBrokerTrading(symbol, date) {
    const client = await pool.connect();
    try {
        const start_date = date || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        console.log(`🔄 [FinMind] Syncing broker trading for ${symbol} starting from ${start_date}...`);
        const data = await fetchFinMind('TaiwanStockBrokerTrading', symbol, start_date);
        for (const item of data) {
            await client.query(`
                INSERT INTO fm_broker_trading (stock_id, date, broker, buy, sell)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (stock_id, date, broker) DO UPDATE SET
                    buy = EXCLUDED.buy,
                    sell = EXCLUDED.sell
            `, [item.stock_id, item.date, item.broker, item.buy, item.sell]);
        }
        console.log(`✅ [FinMind] Synced broker trading for ${symbol}: ${data.length} records.`);
    } catch (err) {
        console.error(`❌ [FinMind] Failed to sync broker trading for ${symbol}:`, err.message);
    } finally {
        client.release();
    }
}

async function syncMarginTrading(symbol) {
    const client = await pool.connect();
    try {
        const start_date = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        console.log(`🔄 [FinMind] Syncing margin trading for ${symbol} starting from ${start_date}...`);
        const data = await fetchFinMind('TaiwanStockMarginPurchaseShortSale', symbol, start_date);
        for (const item of data) {
            await client.query(`
                INSERT INTO fm_margin_trading (
                    stock_id, date, 
                    margin_purchase_buy, margin_purchase_sell, margin_purchase_cash_redemption, margin_purchase_limit, margin_purchase_today_balance, margin_purchase_yesterday_balance,
                    short_sale_buy, short_sale_sell, short_sale_cash_redemption, short_sale_limit, short_sale_today_balance, short_sale_yesterday_balance
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                ON CONFLICT (stock_id, date) DO UPDATE SET
                    margin_purchase_today_balance = EXCLUDED.margin_purchase_today_balance,
                    short_sale_today_balance = EXCLUDED.short_sale_today_balance
            `, [
                item.stock_id, item.date,
                item.MarginPurchaseBuy, item.MarginPurchaseSell, item.MarginPurchaseCashRedemption, item.MarginPurchaseLimit, item.MarginPurchaseTodayBalance, item.MarginPurchaseYesterdayBalance,
                item.ShortSaleBuy, item.ShortSaleSell, item.ShortSaleCashRedemption, item.ShortSaleLimit, item.ShortSaleTodayBalance, item.ShortSaleYesterdayBalance
            ]);
        }
        console.log(`✅ [FinMind] Synced margin trading for ${symbol}: ${data.length} records.`);
    } catch (err) {
        console.error(`❌ [FinMind] Failed to sync margin trading for ${symbol}:`, err.message);
    } finally {
        client.release();
    }
}

async function syncStockFinancials(symbol) {
    const client = await pool.connect();
    try {
        console.log(`🔄 [FinMind] Syncing financials for ${symbol}...`);

        const revenues = await fetchFinMind('TaiwanStockMonthRevenue', symbol);
        for (const item of revenues) {
            await client.query(`
                INSERT INTO monthly_revenue (symbol, revenue_year, revenue_month, revenue)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (symbol, revenue_year, revenue_month) 
                DO UPDATE SET revenue = EXCLUDED.revenue
            `, [symbol, item.revenue_year, item.revenue_month, item.revenue]);
        }

        const statements = await fetchFinMind('TaiwanStockFinancialStatements', symbol);
        for (const item of statements) {
            if (item.type === 'EPS' || item.type === 'EarningsPerShare') {
                await client.query(`
                    INSERT INTO financial_statements (symbol, date, type, value, origin_name)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (symbol, date, type, origin_name) 
                    DO UPDATE SET value = EXCLUDED.value
                `, [symbol, item.date, 'EPS', item.value, item.type]);
            }
        }

        try {
            const dividends = await fetchFinMind('TaiwanStockDividend', symbol);
            for (const item of dividends) {
                const year = parseInt(item.year || item.Year || 0);
                if (year === 0) continue;
                const total = (parseFloat(item.CashEarningsDistribution || 0) + parseFloat(item.StockEarningsDistribution || 0));
                await client.query(`
                    INSERT INTO dividend_policy (symbol, year, cash_dividend, stock_dividend, total_dividend)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (symbol, year) 
                    DO UPDATE SET 
                        cash_dividend = EXCLUDED.cash_dividend,
                        stock_dividend = EXCLUDED.stock_dividend,
                        total_dividend = EXCLUDED.total_dividend
                `, [symbol, year, parseFloat(item.CashEarningsDistribution || 0), parseFloat(item.StockEarningsDistribution || 0), total]);
            }
        } catch (err) { }

        // Sync PER/PBR/Yield
        try {
            const perData = await fetchFinMind('TaiwanStockPER', symbol);
            if (perData && perData.length > 0) {
                const latest = perData[perData.length - 1];
                await client.query(`
                    INSERT INTO fundamentals (symbol, trade_date, pe_ratio, dividend_yield)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (symbol) 
                    DO UPDATE SET 
                        trade_date = EXCLUDED.trade_date,
                        pe_ratio = EXCLUDED.pe_ratio,
                        dividend_yield = EXCLUDED.dividend_yield
                `, [symbol, latest.date, parseFloat(latest.PE) || 0, parseFloat(latest.DividendYield) || 0]);
                console.log(`✅ [FinMind] Updated fundamentals for ${symbol}`);
            }
        } catch (err) {
            console.error(`❌ [FinMind] Failed to sync PER for ${symbol}:`, err.message);
        }

        await syncBrokerTrading(symbol);
        await syncMarginTrading(symbol);

        console.log(`✅ [FinMind] Synced ${symbol} successfully.`);
    } catch (err) {
        console.error(`❌ [FinMind] Failed to sync ${symbol}:`, err.message);
    } finally {
        client.release();
    }
}

async function syncAllStocksFinancials() {
    console.log(getTokenStatus());
    const res = await pool.query(`
        SELECT symbol FROM stocks 
        WHERE symbol ~ '^[0-9]{4}$'
        ORDER BY symbol ASC
    `);
    const stocks = res.rows;
    for (let i = 0; i < stocks.length; i++) {
        await syncStockFinancials(stocks[i].symbol);
        await sleep(6000);
    }
}

module.exports = { syncStockFinancials, syncAllStocksFinancials, syncBrokerTrading, syncMarginTrading };
