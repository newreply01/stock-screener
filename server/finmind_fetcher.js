const { pool } = require('./db');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const BASE_URL = 'https://api.finmindtrade.com/api/v4/data';
const START_DATE = '2021-01-01'; // 3+ years of data

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- Token Rotation Manager ---
const TOKENS = (process.env.FINMIND_TOKENS || process.env.FINMIND_TOKEN || '')
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0);

let currentTokenIndex = 0;
const exhaustedTokens = new Set(); // 記錄已耗盡額度的 token

function getCurrentToken() {
    if (TOKENS.length === 0) return null;
    return TOKENS[currentTokenIndex];
}

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
// --- End Token Rotation Manager ---

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
                // 所有 token 都被限速，等待 60 秒後重試
                console.warn(`⚠️ [FinMind] 所有 Token 都被限速，等待 60s...`);
                await sleep(60000);
                exhaustedTokens.clear(); // 重置，讓所有 token 可以再試
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
        if (data.length > 0) {
            console.log(`🔍 [FinMind] ${dataset} sample for ${data_id}:`, data[0]);
        } else {
            console.log(`⚠️ [FinMind] No data for ${dataset} / ${data_id}`);
        }
        return data;
    } catch (err) {
        console.error(`❌ [FinMind] Error fetching ${dataset} for ${data_id}:`, err.message);
        return [];
    }
}

async function syncStockFinancials(symbol) {
    const client = await pool.connect();
    try {
        console.log(`🔄 [FinMind] Syncing financials for ${symbol}...`);

        // 1. Monthly Revenue
        const revenues = await fetchFinMind('TaiwanStockMonthRevenue', symbol);
        for (const item of revenues) {
            await client.query(`
                INSERT INTO monthly_revenue (symbol, revenue_year, revenue_month, revenue)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (symbol, revenue_year, revenue_month) 
                DO UPDATE SET revenue = EXCLUDED.revenue
            `, [symbol, item.revenue_year, item.revenue_month, item.revenue]);
        }

        // 2. Financial Statements (EPS)
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

        // 3. Dividend
        try {
            const dividends = await fetchFinMind('TaiwanStockDividend', symbol);
            for (const item of dividends) {
                const year = parseInt(item.year || item.Year || 0);
                if (year === 0) continue; // Skip if year is invalid

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
        } catch (err) {
            console.error(`⚠️ [FinMind] Failed to sync Dividends for ${symbol}:`, err.message);
        }

        console.log(`✅ [FinMind] Synced ${symbol} successfully.`);
    } catch (err) {
        console.error(`❌ [FinMind] Failed to sync ${symbol}:`, err.message);
    } finally {
        client.release();
    }
}

async function syncAllStocksFinancials() {
    console.log(getTokenStatus());

    // 優先抓取 4 位數代號的普通股 (排除指數、權證等)
    const res = await pool.query(`
        SELECT symbol FROM stocks 
        WHERE symbol ~ '^[0-9]{4}$'
        ORDER BY symbol ASC
    `);
    const stocks = res.rows;
    console.log(`🚀 [FinMind] Starting prioritized batch sync for ${stocks.length} stocks...`);

    for (let i = 0; i < stocks.length; i++) {
        const stock = stocks[i];
        await syncStockFinancials(stock.symbol);
        // Rate limit: FinMind allows ~600/hour. We sleep 6s between stocks to be safe.
        // 3 calls per stock -> 18s per stock + overhead. 
        // This is slow but safe.
        await sleep(6000);
    }
}

module.exports = { syncStockFinancials, syncAllStocksFinancials };
