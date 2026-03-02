// FinMind API Configuration and Token Management
// Note: FinMind has a rate limit of 600 calls per hour per token.
// Tokens can be configured in the .env file as FINMIND_TOKENS=token1,token2

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { pool } = require('./db');
const fetch = require('node-fetch');
const nodeFetch = fetch.default || fetch;

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
        const res = await nodeFetch(url);
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

async function syncFinancialRatios(symbol) {
    const client = await pool.connect();
    try {
        console.log(`🔄 [FinMind] Calculating financial ratios (ROE/ROA/Margins) for ${symbol}...`);

        console.log(`🔍 [FinMind] Debugging syncFinancialRatios for ${symbol}`);

        // Let's just fetch EVERYTHING for this symbol and log it
        const allRes = await client.query(`SELECT type, item, date FROM fm_financial_statements WHERE stock_id = $1 LIMIT 10`, [symbol]);
        console.log(`🔍 [FinMind] Total rows for ${symbol} in DB: ${allRes.rows.length} (sample shown above)`);
        allRes.rows.forEach(r => console.log(`  - ${r.date}: [${r.type}] [${r.item}]`));

        const res = await client.query(`SELECT date, type, value, item FROM fm_financial_statements WHERE stock_id = $1`, [symbol]);
        console.log(`🔍 [FinMind] Query returned ${res.rows.length} rows for ${symbol}`);

        if (res.rows.length === 0) {
            console.warn(`⚠️ [FinMind] No financial statement data found for ${symbol} in fm_financial_statements, cannot calculate ratios.`);
            return;
        }

        // Group by date
        const dataByDate = {};
        res.rows.forEach(r => {
            // Ensure date is a string in YYYY-MM-DD format
            const dateStr = r.date instanceof Date ? r.date.toISOString().split('T')[0] : r.date;
            if (!dataByDate[dateStr]) dataByDate[dateStr] = {};

            // r.type is the item name (Revenue, TotalAssets, etc.)
            // r.item is the category (Income Statement, Balance Sheet)
            if (r.type) dataByDate[dateStr][r.type] = parseFloat(r.value);
            // Also support localized names if they are in the 'item' column for older data
            if (r.item && r.item !== 'Income Statement' && r.item !== 'Balance Sheet') {
                dataByDate[dateStr][r.item] = parseFloat(r.value);
            }
        });

        let count = 0;
        const sortedDates = Object.keys(dataByDate).sort().reverse();
        if (sortedDates.length > 0) {
            const latestDate = sortedDates[0];
            console.log(`🔍 [FinMind] Latest date: ${latestDate}, keys count: ${Object.keys(dataByDate[latestDate]).length}`);
        }

        for (const [date, data] of Object.entries(dataByDate)) {
            // Support both English and Chinese keys for robustness
            const revenue = data['Revenue'] || data['營業收入'] || 0;
            const grossProfit = data['GrossProfit'] || data['營業毛利（毛損）'] || 0;
            const opIncome = data['OperatingIncome'] || data['營業利益（損失）'] || 0;
            const netIncome = data['NetIncome'] || data['IncomeAfterTaxes'] || data['本期淨利（淨損）'] || 0;
            const totalAssets = data['TotalAssets'] || data['資產總額'] || data['資產總計'] || 0;
            const equity = data['Equity'] || data['權益總額'] || data['權益總計'] || 0;

            const ratios = [];
            if (revenue > 0) {
                ratios.push({ item: 'GrossProfitMargin', value: (grossProfit / revenue) * 100 });
                ratios.push({ item: 'OperatingIncomeMargin', value: (opIncome / revenue) * 100 });
                ratios.push({ item: 'NetIncomeMargin', value: (netIncome / revenue) * 100 });
            }
            if (equity > 0) {
                ratios.push({ item: 'ROE', value: (netIncome / equity) * 100 });
            }
            if (totalAssets > 0) {
                ratios.push({ item: 'ROA', value: (netIncome / totalAssets) * 100 });
            }

            if (ratios.length > 0) {
                for (const r of ratios) {
                    await client.query(`
                        INSERT INTO fm_financial_statements (stock_id, date, type, value, item)
                        VALUES ($1, $2, $3, $4, $5)
                        ON CONFLICT (stock_id, date, type, item) DO UPDATE SET
                            value = EXCLUDED.value
                    `, [symbol, date, 'Ratio', r.value, r.item]);
                }
                count++;
            }
        }
        console.log(`✅ [FinMind] Calculated and saved ratios for ${symbol} across ${count} periods.`);
    } catch (err) {
        console.error(`❌ [FinMind] Failed to calculate ratios for ${symbol}:`, err.message);
    } finally {
        client.release();
    }
}

async function syncDetailedFinancials(symbol) {
    const client = await pool.connect();
    try {
        console.log(`🔄 [FinMind] Syncing detailed financials (BS/IS/CF) for ${symbol}...`);

        // TaiwanStockFinancialStatements datasets:
        // - TaiwanStockFinancialStatements: Income Statement
        // - TaiwanStockBalanceSheet: Balance Sheet
        // - TaiwanStockCashFlowsStatement: Cash Flows
        const datasets = ['TaiwanStockFinancialStatements', 'TaiwanStockBalanceSheet', 'TaiwanStockCashFlowsStatement'];

        for (const dataset of datasets) {
            console.log(`  [FinMind] Fetching ${dataset}...`);
            const data = await fetchFinMind(dataset, symbol);
            if (data && data.length > 0) {
                for (const item of data) {
                    let category = 'Unknown';
                    if (dataset === 'TaiwanStockFinancialStatements') category = 'Income Statement';
                    if (dataset === 'TaiwanStockBalanceSheet') category = 'Balance Sheet';
                    if (dataset === 'TaiwanStockCashFlowsStatement') category = 'Cash Flows';

                    await client.query(`
                        INSERT INTO fm_financial_statements (stock_id, date, type, value, item)
                        VALUES ($1, $2, $3, $4, $5)
                        ON CONFLICT (stock_id, date, type, item) DO UPDATE SET
                            value = EXCLUDED.value
                    `, [symbol, item.date, item.type || item.item, item.value, category]);

                    // Also update legacy tables
                    if (category === 'Balance Sheet') {
                        await client.query(`INSERT INTO fm_balance_sheet (stock_id, date, value, item) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`, [symbol, item.date, item.value, item.origin_name || item.type]).catch(e => { });
                    } else if (category === 'Income Statement') {
                        await client.query(`INSERT INTO fm_income_statement (stock_id, date, value, item) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`, [symbol, item.date, item.value, item.origin_name || item.type]).catch(e => { });
                    }
                }
                console.log(`✅ [FinMind] Synced ${dataset} for ${symbol}: ${data.length} items.`);
            }
        }
    } catch (err) {
        console.error(`❌ [FinMind] Failed to sync detailed financials for ${symbol}:`, err.message);
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

        await syncDetailedFinancials(symbol);

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
        await syncDetailedFinancials(symbol);
        await syncFinancialRatios(symbol);

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

module.exports = { syncStockFinancials, syncAllStocksFinancials, syncBrokerTrading, syncMarginTrading, syncFinancialRatios, syncDetailedFinancials, syncDetailedFinancials };
