/**
 * FinMind Full Sync - 全 34 資料集同步程式
 * 支援：多 Token 輪替、斷點續跑、進度追蹤
 */

// Global crash handlers
process.on('uncaughtException', (err) => {
    console.error('💀 [CRASH] Uncaught Exception:', err.stack || err.message);
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    console.error('💀 [CRASH] Unhandled Rejection:', reason);
    process.exit(1);
});

const { pool } = require('./db');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Periodic Activity Logger
setInterval(() => {
    console.log(`💓 [Heartbeat] ${new Date().toLocaleTimeString()} - Process alive (UP: ${process.uptime().toFixed(0)}s)`);
}, 60000);

process.on('exit', (code) => {
    console.log(`🛑 [Process] Exiting with code: ${code}`);
});

const BASE_URL = 'https://api.finmindtrade.com/api/v4/data';
const START_DATE = '2021-01-01'; // 近 5 年
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ========== CLI Arguments ==========
const args = process.argv.slice(2);
const CL_LIMIT = args.find(a => a.startsWith('--limit='))?.split('=')[1] || null;
const CL_PHASE = args.find(a => a.startsWith('--phase='))?.split('=')[1] || null;
const CL_START = args.find(a => a.startsWith('--start='))?.split('=')[1] || null;

if (CL_LIMIT || CL_PHASE || CL_START) {
    console.log('🛠️ [CLI] Overrides detected:', {
        limit: CL_LIMIT, phase: CL_PHASE, start: CL_START
    });
}

// ========== Token Rotation Manager ==========
const TOKENS = (process.env.FINMIND_TOKENS || process.env.FINMIND_TOKEN || '')
    .split(',').map(t => t.trim()).filter(t => t.length > 0);
let currentTokenIndex = 0;
const exhaustedTokens = new Set();

function getCurrentToken() { return TOKENS.length === 0 ? null : TOKENS[currentTokenIndex]; }

function rotateToken(reason = '') {
    if (TOKENS.length <= 1) return false;
    exhaustedTokens.add(currentTokenIndex);
    for (let i = 1; i < TOKENS.length; i++) {
        const next = (currentTokenIndex + i) % TOKENS.length;
        if (!exhaustedTokens.has(next)) {
            currentTokenIndex = next;
            console.log(`🔄 [Token] 切換至 Token #${next + 1}/${TOKENS.length} (${reason})`);
            return true;
        }
    }
    console.error(`❌ [Token] 所有 ${TOKENS.length} 組 Token 額度皆已耗盡！`);
    return false;
}

// ========== Core API Fetcher ==========
const startTime = Date.now();
let url = `${BASE_URL}?dataset=${dataset}&start_date=${start_date}`;
if (data_id) url += `&data_id=${data_id}`;
const token = getCurrentToken();
if (token) url += `&token=${token}`;

console.log(`  🌐 [Fetch] ${dataset}${data_id ? '/' + data_id : ''} (Token #${currentTokenIndex + 1})`);

try {
    const res = await fetch(url, { timeout: 180000 }); // 3 mins timeout
    if (!res.ok) {
        // ... (keep current 429/402 logic)
        if (res.status === 429) {
            console.warn(`⚠️ [FinMind] Rate limited (429) on Token #${currentTokenIndex + 1}`);
            if (rotateToken('HTTP 429')) return fetchFinMind(dataset, data_id, start_date);
            console.warn(`⚠️ 所有 Token 被限速，等待 60s...`);
            await sleep(60000);
            exhaustedTokens.clear();
            return fetchFinMind(dataset, data_id, start_date);
        }
        if (res.status === 402) {
            console.warn(`⚠️ [FinMind] Token #${currentTokenIndex + 1} 額度耗盡 (402)`);
            if (rotateToken('HTTP 402')) return fetchFinMind(dataset, data_id, start_date);
            console.warn(`⚠️ 所有 Token 額度皆已耗盡 (402)，等待 60s 後重試...`);
            await sleep(60000);
            exhaustedTokens.clear();
            return fetchFinMind(dataset, data_id, start_date);
        }
        throw new Error(`HTTP ${res.status}`);
    }

    console.log(`  📦 [Response] Received headers, reading body...`);
    const text = await res.text();
    console.log(`  📦 [Body] Size: ${(text.length / 1024).toFixed(1)} KB`);

    console.log(`  ⚙️ [JSON] Parsing...`);
    const json = JSON.parse(text);
    const data = json.data || [];
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  📊 [Data] Records: ${data.length} (${duration}s)`);
    return data;
} catch (err) {
    console.error(`❌ [FinMind] ${dataset}${data_id ? '/' + data_id : ''} 錯誤: ${err.message}`);
    return [];
}
}

// ========== Progress Tracker ==========
async function isCompleted(dataset, stockId = '') {
    const res = await pool.query(
        'SELECT 1 FROM fm_sync_progress WHERE dataset=$1 AND stock_id=$2',
        [dataset, stockId]
    );
    return res.rows.length > 0;
}

async function markCompleted(dataset, stockId = '') {
    await pool.query(
        `INSERT INTO fm_sync_progress (dataset, stock_id) VALUES ($1, $2)
         ON CONFLICT (dataset, stock_id) DO UPDATE SET last_sync_date = NOW()`,
        [dataset, stockId]
    );
}

// ========== Generic Upsert Helper (batch transactions) ==========
async function bulkUpsert(client, table, columns, conflictKeys, rows) {
    if (!rows || rows.length === 0) return 0;
    let count = 0;
    const BATCH_SIZE = 500;
    console.log(`    🚀 [${table}] 開始寫入 ${rows.length} 筆資料 (Batch Size: ${BATCH_SIZE})`);

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        try {
            await client.query('BEGIN');
            for (const row of batch) {
                const values = columns.map(c => row[c] !== undefined ? row[c] : null);
                const placeholders = columns.map((_, j) => `$${j + 1}`).join(', ');
                const updates = columns
                    .filter(c => !conflictKeys.includes(c))
                    .map(c => `${c} = EXCLUDED.${c}`)
                    .join(', ');
                const conflictClause = conflictKeys.join(', ');
                const sql = updates
                    ? `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT (${conflictClause}) DO UPDATE SET ${updates}`
                    : `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT (${conflictClause}) DO NOTHING`;

                await client.query(sql, values);
                count++;
            }
            await client.query('COMMIT');
            console.log(`    📦 [${table}] 寫入進度: ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
        } catch (e) {
            await client.query('ROLLBACK').catch(() => { });
            console.error(`  ❌ [${table}] Batch error at row ${i}: ${e.message}`);
            // If it's a fatal DB error, rethrow to stop the script
            if (e.message.includes('terminat') || e.message.includes('connection')) throw e;
        }
    }
    return count;
}

// ========== Get All Stock Symbols ==========
async function getAllStockSymbols() {
    const res = await pool.query(`SELECT symbol FROM stocks WHERE symbol ~ '^[0-9]{4}$' ORDER BY symbol ASC`);
    return res.rows.map(r => r.symbol);
}

// ========== Dataset Sync Functions ==========

// --- 全量類 (不需 data_id, 一次抓完) ---

async function syncTaiwanStockInfo() {
    const ds = 'TaiwanStockInfo';
    if (await isCompleted(ds)) { console.log(`⏭️ ${ds} 已完成`); return; }
    console.log(`📥 [${ds}] 同步台股總覽...`);
    const data = await fetchFinMind(ds);
    const client = await pool.connect();
    try {
        let count = 0;
        for (const item of data) {
            try {
                await client.query(
                    `INSERT INTO stocks (symbol, name, industry, market) VALUES ($1, $2, $3, $4)
                     ON CONFLICT (symbol) DO UPDATE SET name=EXCLUDED.name, industry=EXCLUDED.industry`,
                    [String(item.stock_id || '').substring(0, 20), String(item.stock_name || '').substring(0, 200), String(item.industry_category || '').substring(0, 200), String(item.type || '').substring(0, 200)]
                );
                count++;
            } catch (e) { /* skip bad row */ }
        }
        console.log(`✅ [${ds}] 同步 ${count}/${data.length} 筆`);
        await markCompleted(ds);
    } finally { client.release(); }
}

async function syncTaiwanStockTradingDate() {
    const ds = 'TaiwanStockTradingDate';
    if (await isCompleted(ds)) { console.log(`⏭️ ${ds} 已完成`); return; }
    console.log(`📥 [${ds}] 同步交易日...`);
    const data = await fetchFinMind(ds);
    const client = await pool.connect();
    try {
        const mapped = data.map(item => ({
            date: item.date,
            description: String(item.description || '').substring(0, 100)
        }));

        const count = await bulkUpsert(client, 'trading_dates', ['date', 'description'], ['date'], mapped);
        console.log(`✅ [${ds}] 同步 ${count}/${data.length} 筆`);
        await markCompleted(ds);
    } catch (e) {
        console.error(`❌ [${ds}] 錯誤: ${e.message}`);
    } finally { client.release(); }
}

async function syncTaiwanStockTotalReturnIndex() {
    const ds = 'TaiwanStockTotalReturnIndex';
    if (await isCompleted(ds)) { console.log(`⏭️ ${ds} 已完成`); return; }
    console.log(`📥 [${ds}] 同步報酬指數...`);
    const data = await fetchFinMind(ds);
    const client = await pool.connect();
    try {
        const count = await bulkUpsert(client, 'fm_total_return_index',
            ['date', 'price', 'stock_id'], ['stock_id', 'date'], data);
        console.log(`✅ [${ds}] 同步 ${count} 筆`);
        await markCompleted(ds);
    } finally { client.release(); }
}

async function syncTaiwanStockTotalMarginPurchaseShortSale() {
    const ds = 'TaiwanStockTotalMarginPurchaseShortSale';
    if (await isCompleted(ds)) { console.log(`⏭️ ${ds} 已完成`); return; }
    console.log(`📥 [${ds}] 同步整體融資融券...`);
    const data = await fetchFinMind(ds);
    const client = await pool.connect();
    try {
        const cols = ['date', 'name', 'margin_purchase_buy', 'margin_purchase_sell',
            'margin_purchase_cash_repayment', 'margin_purchase_yesterday_balance',
            'margin_purchase_today_balance', 'short_sale_buy', 'short_sale_sell',
            'short_sale_cash_repayment', 'short_sale_yesterday_balance', 'short_sale_today_balance'];
        // Map API fields to DB columns
        const mapped = data.map(d => ({
            date: d.date, name: d.name || d.Name || '',
            margin_purchase_buy: d.MarginPurchaseBuy, margin_purchase_sell: d.MarginPurchaseSell,
            margin_purchase_cash_repayment: d.MarginPurchaseCashRepayment,
            margin_purchase_yesterday_balance: d.MarginPurchaseYesterdayBalance,
            margin_purchase_today_balance: d.MarginPurchaseTodayBalance,
            short_sale_buy: d.ShortSaleBuy, short_sale_sell: d.ShortSaleSell,
            short_sale_cash_repayment: d.ShortSaleCashRepayment,
            short_sale_yesterday_balance: d.ShortSaleYesterdayBalance,
            short_sale_today_balance: d.ShortSaleTodayBalance
        }));
        const count = await bulkUpsert(client, 'fm_total_margin', cols, ['date', 'name'], mapped);
        console.log(`✅ [${ds}] 同步 ${count} 筆`);
        await markCompleted(ds);
    } finally { client.release(); }
}

async function syncTaiwanStockTotalInstitutionalInvestors() {
    const ds = 'TaiwanStockTotalInstitutionalInvestors';
    if (await isCompleted(ds)) { console.log(`⏭️ ${ds} 已完成`); return; }
    console.log(`📥 [${ds}] 同步整體法人買賣...`);
    const data = await fetchFinMind(ds);
    const client = await pool.connect();
    try {
        const mapped = data.map(d => ({ date: d.date, name: d.name, buy: d.buy, sell: d.sell }));
        const count = await bulkUpsert(client, 'fm_total_institutional',
            ['date', 'name', 'buy', 'sell'], ['date', 'name'], mapped);
        console.log(`✅ [${ds}] 同步 ${count} 筆`);
        await markCompleted(ds);
    } finally { client.release(); }
}

async function syncTaiwanStockDelisting() {
    const ds = 'TaiwanStockDelisting';
    if (await isCompleted(ds)) { console.log(`⏭️ ${ds} 已完成`); return; }
    console.log(`📥 [${ds}] 同步下市櫃表...`);
    const data = await fetchFinMind(ds);
    const client = await pool.connect();
    try {
        const mapped = data.map(d => ({
            stock_id: d.stock_id, date: d.date, stock_name: d.stock_name || '', reason: d.reason || ''
        }));
        const count = await bulkUpsert(client, 'fm_delisting',
            ['stock_id', 'date', 'stock_name', 'reason'], ['stock_id', 'date'], mapped);
        console.log(`✅ [${ds}] 同步 ${count} 筆`);
        await markCompleted(ds);
    } finally { client.release(); }
}

async function syncTaiwanSecuritiesTraderInfo() {
    const ds = 'TaiwanSecuritiesTraderInfo';
    if (await isCompleted(ds)) { console.log(`⏭️ ${ds} 已完成`); return; }
    console.log(`📥 [${ds}] 同步券商資訊...`);
    const data = await fetchFinMind(ds);
    const client = await pool.connect();
    try {
        const mapped = data.map(d => ({
            securities_trader_id: d.securities_trader_id, securities_trader: d.securities_trader || '',
            address: d.address || '', phone: d.phone || '', is_main: d.is_main || false
        }));
        const count = await bulkUpsert(client, 'fm_securities_trader_info',
            ['securities_trader_id', 'securities_trader', 'address', 'phone', 'is_main'],
            ['securities_trader_id'], mapped);
        console.log(`✅ [${ds}] 同步 ${count} 筆`);
        await markCompleted(ds);
    } finally { client.release(); }
}

// --- 衍生性：全量類 ---

async function syncTaiwanFutOptDailyInfo() {
    const ds = 'TaiwanFutOptDailyInfo';
    if (await isCompleted(ds)) { console.log(`⏭️ ${ds} 已完成`); return; }
    console.log(`📥 [${ds}] 同步期貨選擇權總覽...`);
    const data = await fetchFinMind(ds);
    const client = await pool.connect();
    try {
        const mapped = data.map(d => ({
            date: d.date, call_put: d.call_put || '', contract_date: d.contract_date || '',
            close: d.close, change_percent: d.change_percent, open: d.open, high: d.high,
            low: d.low, volume: d.volume, settlement_price: d.settlement_price,
            open_interest: d.open_interest, trading_session: d.trading_session || '',
            futures_id: d.futures_id || d.code || ''
        }));
        const count = await bulkUpsert(client, 'fm_futopt_daily_info',
            ['date', 'call_put', 'contract_date', 'close', 'change_percent', 'open', 'high',
                'low', 'volume', 'settlement_price', 'open_interest', 'trading_session', 'futures_id'],
            ['date', 'futures_id', 'contract_date'], mapped);
        console.log(`✅ [${ds}] 同步 ${count} 筆`);
        await markCompleted(ds);
    } finally { client.release(); }
}

async function syncTaiwanFuturesInstitutionalInvestors() {
    const ds = 'TaiwanFuturesInstitutionalInvestors';
    if (await isCompleted(ds)) { console.log(`⏭️ ${ds} 已完成`); return; }
    console.log(`📥 [${ds}] 同步期貨法人...`);
    const data = await fetchFinMind(ds);
    const client = await pool.connect();
    try {
        const mapped = data.map(d => ({
            date: d.date, name: d.name || '',
            institutional_investors: d.institutional_investors || '',
            long_deal_volume: d.long_deal_volume, long_deal_amount: d.long_deal_amount,
            short_deal_volume: d.short_deal_volume, short_deal_amount: d.short_deal_amount,
            long_open_interest_volume: d.long_open_interest_volume,
            long_open_interest_amount: d.long_open_interest_amount,
            short_open_interest_volume: d.short_open_interest_volume,
            short_open_interest_amount: d.short_open_interest_amount
        }));
        const count = await bulkUpsert(client, 'fm_futures_institutional',
            ['date', 'name', 'institutional_investors', 'long_deal_volume', 'long_deal_amount',
                'short_deal_volume', 'short_deal_amount', 'long_open_interest_volume',
                'long_open_interest_amount', 'short_open_interest_volume', 'short_open_interest_amount'],
            ['date', 'name', 'institutional_investors'], mapped);
        console.log(`✅ [${ds}] 同步 ${count} 筆`);
        await markCompleted(ds);
    } finally { client.release(); }
}

async function syncTaiwanOptionInstitutionalInvestors() {
    const ds = 'TaiwanOptionInstitutionalInvestors';
    if (await isCompleted(ds)) { console.log(`⏭️ ${ds} 已完成`); return; }
    console.log(`📥 [${ds}] 同步選擇權法人...`);
    const data = await fetchFinMind(ds);
    const client = await pool.connect();
    try {
        const mapped = data.map(d => ({
            date: d.date, name: d.name || '',
            institutional_investors: d.institutional_investors || '',
            long_deal_volume: d.long_deal_volume, long_deal_amount: d.long_deal_amount,
            short_deal_volume: d.short_deal_volume, short_deal_amount: d.short_deal_amount,
            long_open_interest_volume: d.long_open_interest_volume,
            long_open_interest_amount: d.long_open_interest_amount,
            short_open_interest_volume: d.short_open_interest_volume,
            short_open_interest_amount: d.short_open_interest_amount
        }));
        const count = await bulkUpsert(client, 'fm_option_institutional',
            ['date', 'name', 'institutional_investors', 'long_deal_volume', 'long_deal_amount',
                'short_deal_volume', 'short_deal_amount', 'long_open_interest_volume',
                'long_open_interest_amount', 'short_open_interest_volume', 'short_open_interest_amount'],
            ['date', 'name', 'institutional_investors'], mapped);
        console.log(`✅ [${ds}] 同步 ${count} 筆`);
        await markCompleted(ds);
    } finally { client.release(); }
}

// --- 逐股類 (需要 data_id 逐股抓取) ---

// Generic per-stock sync function
async function syncPerStock(dataset, table, columns, conflictKeys, mapFn) {
    let symbols = await getAllStockSymbols();

    // Apply CLI start override
    if (CL_START) {
        const startIndex = symbols.findIndex(s => s >= CL_START);
        if (startIndex !== -1) {
            console.log(`  ⏩ [${dataset}] Starting from ${CL_START} (index ${startIndex})`);
            symbols = symbols.slice(startIndex);
        }
    }

    console.log(`📥 [${dataset}] 開始逐股同步 ${symbols.length} 檔...`);
    let synced = 0, skipped = 0;

    for (const symbol of symbols) {
        // Apply CLI limit override
        if (CL_LIMIT && synced >= parseInt(CL_LIMIT)) {
            console.log(`  ✋ [${dataset}] Reached limit of ${CL_LIMIT}, stopping phase.`);
            break;
        }

        if (await isCompleted(dataset, symbol)) {
            skipped++;
            continue;
        }

        console.log(`  👉 [${dataset}] ${synced + 1}/${symbols.length} (${symbol}) starting...`);
        const itemStartTime = Date.now();

        try {
            const data = await fetchFinMind(dataset, symbol);
            if (data && data.length > 0) {
                const client = await pool.connect();
                try {
                    const mapped = data.map(mapFn);
                    await bulkUpsert(client, table, columns, conflictKeys, mapped);
                } finally {
                    client.release();
                }
            }
            await markCompleted(dataset, symbol);
            synced++;
            const itemElapsed = ((Date.now() - itemStartTime) / 1000).toFixed(1);
            console.log(`  ✅ [${dataset}] ${symbol} done in ${itemElapsed}s`);
        } catch (e) {
            console.error(`  ❌ [${dataset}] ${symbol} 嚴重錯誤: ${e.message}`);
            // Let it continue to next stock
        }

        if (synced % 10 === 0 && synced > 0) {
            console.log(`📊 [${dataset}] Progress: ${synced}/${symbols.length} processed (Skipped: ${skipped})`);
        }
        await sleep(3000); // Rate limit: ~3s per stock
    }
    console.log(`✅ [${dataset}] 完成！同步 ${synced}，跳過 ${skipped}`);
}

// 4. TaiwanStockPrice
function syncStockPrice() {
    return syncPerStock('TaiwanStockPrice', 'fm_stock_price',
        ['stock_id', 'date', 'open', 'high', 'low', 'close', 'volume', 'spread', 'trading_value', 'trading_turnover'],
        ['stock_id', 'date'],
        d => ({
            stock_id: d.stock_id, date: d.date, open: d.open, high: d.max, low: d.min, close: d.close,
            volume: d.Trading_Volume, spread: d.spread, trading_value: d.Trading_money, trading_turnover: d.Trading_turnover
        })
    );
}

// 5. TaiwanStockPER
function syncStockPER() {
    return syncPerStock('TaiwanStockPER', 'fm_stock_per',
        ['stock_id', 'date', 'pe_ratio', 'pb_ratio', 'dividend_yield'],
        ['stock_id', 'date'],
        d => ({ stock_id: d.stock_id, date: d.date, pe_ratio: d.PER, pb_ratio: d.PBR, dividend_yield: d.dividend_yield })
    );
}

// 6. TaiwanStockDayTrading
function syncStockDayTrading() {
    return syncPerStock('TaiwanStockDayTrading', 'fm_day_trading',
        ['stock_id', 'date', 'buy_after_sell_volume', 'buy_after_sell_amount',
            'sell_after_buy_volume', 'sell_after_buy_amount', 'day_trade_volume', 'day_trade_amount'],
        ['stock_id', 'date'],
        d => ({
            stock_id: d.stock_id, date: d.date,
            buy_after_sell_volume: d.BuyAfterSellVolume, buy_after_sell_amount: d.BuyAfterSellAmount,
            sell_after_buy_volume: d.SellAfterBuyVolume, sell_after_buy_amount: d.SellAfterBuyAmount,
            day_trade_volume: d.DayTradeVolume || d.volume, day_trade_amount: d.DayTradeAmount || d.amount
        })
    );
}

// 8. TaiwanStockFinancialStatements
function syncFinancialStatements() {
    return syncPerStock('TaiwanStockFinancialStatements', 'fm_financial_statements',
        ['stock_id', 'date', 'type', 'value', 'origin_name'],
        ['stock_id', 'date', 'type'],
        d => ({ stock_id: d.stock_id, date: d.date, type: d.type, value: d.value, origin_name: d.origin_name || d.type })
    );
}

// 9. TaiwanStockBalanceSheet
function syncBalanceSheet() {
    return syncPerStock('TaiwanStockBalanceSheet', 'fm_balance_sheet',
        ['stock_id', 'date', 'type', 'value', 'origin_name'],
        ['stock_id', 'date', 'type'],
        d => ({ stock_id: d.stock_id, date: d.date, type: d.type, value: d.value, origin_name: d.origin_name || d.type })
    );
}

// 10. TaiwanStockCashFlowsStatement
function syncCashFlows() {
    return syncPerStock('TaiwanStockCashFlowsStatement', 'fm_cash_flows',
        ['stock_id', 'date', 'type', 'value', 'origin_name'],
        ['stock_id', 'date', 'type'],
        d => ({ stock_id: d.stock_id, date: d.date, type: d.type, value: d.value, origin_name: d.origin_name || d.type })
    );
}

// 11. TaiwanStockDividend
function syncDividend() {
    return syncPerStock('TaiwanStockDividend', 'fm_dividend',
        ['stock_id', 'date', 'year', 'stock_earnings_distribution', 'stock_statutory_surplus_distribution',
            'stock_surplus_distribution', 'cash_earnings_distribution', 'cash_statutory_surplus_distribution',
            'cash_surplus_distribution', 'cash_dividend', 'stock_dividend', 'total_dividend'],
        ['stock_id', 'date'],
        d => ({
            stock_id: d.stock_id, date: d.date, year: parseInt(d.year || d.Year || 0),
            stock_earnings_distribution: d.StockEarningsDistribution,
            stock_statutory_surplus_distribution: d.StockStatutorySurplusDistribution,
            stock_surplus_distribution: d.StockSurplusDistribution || 0,
            cash_earnings_distribution: d.CashEarningsDistribution,
            cash_statutory_surplus_distribution: d.CashStatutorySurplusDistribution,
            cash_surplus_distribution: d.CashSurplusDistribution || 0,
            cash_dividend: (parseFloat(d.CashEarningsDistribution || 0) + parseFloat(d.CashStatutorySurplusDistribution || 0)),
            stock_dividend: (parseFloat(d.StockEarningsDistribution || 0) + parseFloat(d.StockStatutorySurplusDistribution || 0)),
            total_dividend: (parseFloat(d.CashEarningsDistribution || 0) + parseFloat(d.CashStatutorySurplusDistribution || 0) +
                parseFloat(d.StockEarningsDistribution || 0) + parseFloat(d.StockStatutorySurplusDistribution || 0))
        })
    );
}

// 12. TaiwanStockDividendResult
function syncDividendResult() {
    return syncPerStock('TaiwanStockDividendResult', 'fm_dividend_result',
        ['stock_id', 'date', 'before_price', 'after_price', 'stock_and_cash_dividend',
            'rate_of_return', 'cash_dividend', 'stock_dividend'],
        ['stock_id', 'date'],
        d => ({
            stock_id: d.stock_id, date: d.date, before_price: d.before, after_price: d.after,
            stock_and_cash_dividend: d.stock_and_cash_dividend, rate_of_return: d.rate_of_return,
            cash_dividend: d.cash_dividend, stock_dividend: d.stock_dividend
        })
    );
}

// 13. TaiwanStockMonthRevenue
function syncMonthRevenue() {
    return syncPerStock('TaiwanStockMonthRevenue', 'fm_month_revenue',
        ['stock_id', 'date', 'country', 'revenue', 'revenue_month', 'revenue_year'],
        ['stock_id', 'date'],
        d => ({
            stock_id: d.stock_id, date: d.date, country: d.country || 'TW',
            revenue: d.revenue, revenue_month: d.revenue_month, revenue_year: d.revenue_year
        })
    );
}

// 14. TaiwanStockCapitalReductionReferencePrice
function syncCapitalReduction() {
    return syncPerStock('TaiwanStockCapitalReductionReferencePrice', 'fm_capital_reduction',
        ['stock_id', 'date', 'closing_price', 'reduction_per_share', 'reference_price',
            'limit_up', 'limit_down', 'open_date', 'reason'],
        ['stock_id', 'date'],
        d => ({
            stock_id: d.stock_id, date: d.date, closing_price: d.ClosingPriceonTheLastTradingDay,
            reduction_per_share: d.ReductionPerShare, reference_price: d.PostReductionReferencePrice,
            limit_up: d.LimitUp, limit_down: d.LimitDown, open_date: d.OpeningDate || null,
            reason: d.ReasonforCapitalReduction || ''
        })
    );
}

// 16. TaiwanStockSplitPrice
function syncSplitPrice() {
    return syncPerStock('TaiwanStockSplitPrice', 'fm_split_price',
        ['stock_id', 'date', 'before_price', 'after_price'],
        ['stock_id', 'date'],
        d => ({ stock_id: d.stock_id, date: d.date, before_price: d.before, after_price: d.after })
    );
}

// 17. TaiwanStockParValueChange
function syncParValueChange() {
    return syncPerStock('TaiwanStockParValueChange', 'fm_par_value_change',
        ['stock_id', 'date', 'before_price', 'after_price'],
        ['stock_id', 'date'],
        d => ({ stock_id: d.stock_id, date: d.date, before_price: d.before, after_price: d.after })
    );
}

// 18. TaiwanStockMarginPurchaseShortSale
function syncMarginTrading() {
    return syncPerStock('TaiwanStockMarginPurchaseShortSale', 'fm_margin_trading',
        ['stock_id', 'date', 'margin_purchase_buy', 'margin_purchase_sell',
            'margin_purchase_cash_repayment', 'margin_purchase_yesterday_balance',
            'margin_purchase_today_balance', 'margin_purchase_limit',
            'short_sale_buy', 'short_sale_sell', 'short_sale_cash_repayment',
            'short_sale_yesterday_balance', 'short_sale_today_balance', 'short_sale_limit',
            'offsetting_margin_short', 'note'],
        ['stock_id', 'date'],
        d => ({
            stock_id: d.stock_id, date: d.date,
            margin_purchase_buy: d.MarginPurchaseBuy, margin_purchase_sell: d.MarginPurchaseSell,
            margin_purchase_cash_repayment: d.MarginPurchaseCashRepayment,
            margin_purchase_yesterday_balance: d.MarginPurchaseYesterdayBalance,
            margin_purchase_today_balance: d.MarginPurchaseTodayBalance,
            margin_purchase_limit: d.MarginPurchaseLimit,
            short_sale_buy: d.ShortSaleBuy, short_sale_sell: d.ShortSaleSell,
            short_sale_cash_repayment: d.ShortSaleCashRepayment,
            short_sale_yesterday_balance: d.ShortSaleYesterdayBalance,
            short_sale_today_balance: d.ShortSaleTodayBalance,
            short_sale_limit: d.ShortSaleLimit,
            offsetting_margin_short: d.OffsetLoanAndShort || 0,
            note: d.Note || ''
        })
    );
}

// 20. TaiwanStockInstitutionalInvestorsBuySell
function syncInstitutional() {
    return syncPerStock('TaiwanStockInstitutionalInvestorsBuySell', 'fm_institutional',
        ['stock_id', 'date', 'name', 'buy', 'sell'],
        ['stock_id', 'date', 'name'],
        d => ({ stock_id: d.stock_id, date: d.date, name: d.name, buy: d.buy, sell: d.sell })
    );
}

// 22. TaiwanStockShareholding
function syncShareholding() {
    return syncPerStock('TaiwanStockShareholding', 'fm_shareholding',
        ['stock_id', 'date', 'foreign_invest_volume', 'foreign_invest_ratio'],
        ['stock_id', 'date'],
        d => ({
            stock_id: d.stock_id, date: d.date,
            foreign_invest_volume: d.ForeignInvestmentShares || d.ForeignInvestmentVolume,
            foreign_invest_ratio: d.ForeignInvestmentRemainingSharesRatio || d.ForeignInvestmentSharesRatio
        })
    );
}

// 23. TaiwanStockSecuritiesLending
function syncSecuritiesLending() {
    return syncPerStock('TaiwanStockSecuritiesLending', 'fm_securities_lending',
        ['stock_id', 'date', 'transaction_type', 'volume', 'fee_rate', 'close'],
        ['stock_id', 'date', 'transaction_type'],
        d => ({
            stock_id: d.stock_id, date: d.date,
            transaction_type: d.transaction_type || d.TransactionType || '',
            volume: d.volume || d.Volume, fee_rate: d.fee_rate || d.FeeRate || 0,
            close: d.close || d.Close || 0
        })
    );
}

// 24. TaiwanStockMarginShortSaleSuspension
function syncShortSaleSuspension() {
    return syncPerStock('TaiwanStockMarginShortSaleSuspension', 'fm_short_sale_suspension',
        ['stock_id', 'date', 'reason', 'start_date', 'end_date'],
        ['stock_id', 'date'],
        d => ({
            stock_id: d.stock_id, date: d.date, reason: d.reason || '',
            start_date: d.start_date || null, end_date: d.end_date || null
        })
    );
}

// 25. TaiwanDailyShortSaleBalances
function syncShortSaleBalances() {
    return syncPerStock('TaiwanDailyShortSaleBalances', 'fm_short_sale_balances',
        ['stock_id', 'date', 'margin_short_balance_previous_day', 'margin_short_sell_volume',
            'margin_short_buy_volume', 'margin_short_cash_repayment', 'margin_short_balance', 'margin_short_quota'],
        ['stock_id', 'date'],
        d => ({
            stock_id: d.stock_id, date: d.date,
            margin_short_balance_previous_day: d.MarginShortBalancePreviousDay,
            margin_short_sell_volume: d.MarginShortSellVolume,
            margin_short_buy_volume: d.MarginShortBuyVolume,
            margin_short_cash_repayment: d.MarginShortCashRepayment,
            margin_short_balance: d.MarginShortBalance,
            margin_short_quota: d.MarginShortQuota
        })
    );
}

// 28. TaiwanFuturesDaily (逐商品)
function syncFuturesDaily() {
    return syncPerStock('TaiwanFuturesDaily', 'fm_futures_daily',
        ['date', 'futures_id', 'contract_date', 'open', 'high', 'low', 'close', 'change',
            'change_percent', 'volume', 'settlement_price', 'open_interest', 'trading_session'],
        ['date', 'futures_id', 'contract_date'],
        d => ({
            date: d.date, futures_id: d.futures_id || d.code, contract_date: d.contract_date || '',
            open: d.open, high: d.max || d.high, low: d.min || d.low, close: d.close,
            change: d.change, change_percent: d.change_percent, volume: d.volume,
            settlement_price: d.settlement_price, open_interest: d.open_interest,
            trading_session: d.trading_session || ''
        })
    );
}

// 29. TaiwanOptionDaily (逐商品)
function syncOptionDaily() {
    return syncPerStock('TaiwanOptionDaily', 'fm_option_daily',
        ['date', 'option_id', 'contract_date', 'call_put', 'strike_price', 'open', 'high', 'low',
            'close', 'volume', 'settlement_price', 'open_interest', 'trading_session'],
        ['date', 'option_id', 'contract_date', 'call_put', 'strike_price'],
        d => ({
            date: d.date, option_id: d.option_id || d.code, contract_date: d.contract_date || '',
            call_put: d.call_put || '', strike_price: d.strike_price || 0,
            open: d.open, high: d.max || d.high, low: d.min || d.low, close: d.close,
            volume: d.volume, settlement_price: d.settlement_price,
            open_interest: d.open_interest, trading_session: d.trading_session || ''
        })
    );
}

// 32. TaiwanFuturesDealerTradingVolumeDaily
function syncFuturesDealer() {
    return syncPerStock('TaiwanFuturesDealerTradingVolumeDaily', 'fm_futures_dealer',
        ['date', 'futures_id', 'dealer_id', 'dealer_name', 'volume', 'is_buy'],
        ['date', 'futures_id', 'dealer_id', 'is_buy'],
        d => ({
            date: d.date, futures_id: d.futures_id || d.code,
            dealer_id: d.dealer_code || d.securities_trader_id || '',
            dealer_name: d.dealer_name || d.securities_trader || '', volume: d.volume,
            is_buy: d.is_buy !== undefined ? d.is_buy : true
        })
    );
}

// 33. TaiwanOptionDealerTradingVolumeDaily
function syncOptionDealer() {
    return syncPerStock('TaiwanOptionDealerTradingVolumeDaily', 'fm_option_dealer',
        ['date', 'option_id', 'dealer_id', 'dealer_name', 'volume', 'is_buy'],
        ['date', 'option_id', 'dealer_id', 'is_buy'],
        d => ({
            date: d.date, option_id: d.option_id || d.code,
            dealer_id: d.dealer_code || d.securities_trader_id || '',
            dealer_name: d.dealer_name || d.securities_trader || '', volume: d.volume,
            is_buy: d.is_buy !== undefined ? d.is_buy : true
        })
    );
}

// 34. TaiwanStockNews
function syncStockNews() {
    return syncPerStock('TaiwanStockNews', 'fm_stock_news',
        ['stock_id', 'date', 'title', 'source', 'description'],
        ['stock_id', 'date', 'title'],
        d => ({
            stock_id: d.stock_id, date: d.date, title: d.title || '',
            source: d.source || '', description: d.description || ''
        })
    );
}

// ========== Taiwan Stock Info With Warrant ==========
async function syncTaiwanStockInfoWithWarrant() {
    const ds = 'TaiwanStockInfoWithWarrant';
    if (await isCompleted(ds)) { console.log(`⏭️ ${ds} 已完成`); return; }
    console.log(`📥 [${ds}] 同步含權證總覽 (僅存 4 碼股票)...`);
    const data = await fetchFinMind(ds);
    // Filter: only keep 4-digit numeric stock IDs (skip 100K+ warrants)
    const stocks = data.filter(d => /^[0-9]{4}$/.test(d.stock_id));
    console.log(`  📊 篩選後: ${stocks.length}/${data.length} 筆 (4碼股票)`);

    const client = await pool.connect();
    try {
        const mapped = stocks.map(item => ({
            symbol: String(item.stock_id || '').substring(0, 20),
            name: String(item.stock_name || '').substring(0, 200),
            industry: String(item.industry_category || '').substring(0, 200),
            market: String(item.type || '').substring(0, 200)
        }));

        const count = await bulkUpsert(client, 'stocks',
            ['symbol', 'name', 'industry', 'market'],
            ['symbol'], mapped);

        console.log(`✅ [${ds}] 同步 ${count}/${stocks.length} 筆`);
        await markCompleted(ds);
    } catch (e) {
        console.error(`❌ [${ds}] 錯誤: ${e.message}`);
        // Consider this non-critical as TaiwanStockInfo already ran
        await markCompleted(ds);
    } finally { client.release(); }
}

// ========== Main Orchestrator ==========
async function syncAll() {
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('  📦 FinMind 全量同步 - 34 資料集 × 近 5 年');
    console.log(`  🔑 Token: ${TOKENS.length} 組，從 #${currentTokenIndex + 1} 開始`);
    console.log(`  📅 起始日期: ${START_DATE}`);
    console.log('═══════════════════════════════════════════════════');
    console.log('');

    const startTime = Date.now();

    // Helper to safely run a sync function
    async function safeSync(phase, name, fn) {
        if (CL_PHASE && parseInt(CL_PHASE) !== phase) {
            // Skip phase
            return;
        }
        console.log(`\n⏳ [${new Date().toLocaleTimeString()}] 開始同步: ${name} (Phase ${phase})`);
        try {
            await fn();
            console.log(`✅ [${new Date().toLocaleTimeString()}] 完成同步: ${name}`);
        } catch (e) {
            console.error(`⚠️ [${name}] 失敗，跳過: ${e.message}`);
        }
        await sleep(2000);
    }

    // Phase 1: 全量資料集 (快速，不需要逐股)
    console.log('\n🔶 Phase 1: 全量資料集 (無需逐股)\n');
    await safeSync(1, 'TaiwanStockInfo', syncTaiwanStockInfo);
    await safeSync(1, 'TaiwanStockTradingDate', syncTaiwanStockTradingDate);
    // Skiped large/problematic ones for now
    // await safeSync(1, 'TaiwanStockTotalReturnIndex', syncTaiwanStockTotalReturnIndex);
    await safeSync(1, 'TaiwanStockTotalMarginPurchaseShortSale', syncTaiwanStockTotalMarginPurchaseShortSale);
    await safeSync(1, 'TaiwanStockTotalInstitutionalInvestors', syncTaiwanStockTotalInstitutionalInvestors);
    await safeSync(1, 'TaiwanStockDelisting', syncTaiwanStockDelisting);
    await safeSync(1, 'TaiwanSecuritiesTraderInfo', syncTaiwanSecuritiesTraderInfo);
    await safeSync(1, 'TaiwanFutOptDailyInfo', syncTaiwanFutOptDailyInfo);
    await safeSync(1, 'TaiwanFuturesInstitutionalInvestors', syncTaiwanFuturesInstitutionalInvestors);
    await safeSync(1, 'TaiwanOptionInstitutionalInvestors', syncTaiwanOptionInstitutionalInvestors);

    // Phase 2: 技術面逐股 (核心)
    console.log('\n🔶 Phase 2: 技術面 (逐股)\n');
    await safeSync(2, 'StockPrice', syncStockPrice);
    await safeSync(2, 'StockPER', syncStockPER);
    await safeSync(2, 'StockDayTrading', syncStockDayTrading);

    // Phase 3: 基本面逐股
    console.log('\n🔶 Phase 3: 基本面 (逐股)\n');
    await safeSync(3, 'FinancialStatements', syncFinancialStatements);
    await safeSync(3, 'BalanceSheet', syncBalanceSheet);
    await safeSync(3, 'CashFlows', syncCashFlows);
    await safeSync(3, 'Dividend', syncDividend);
    await safeSync(3, 'DividendResult', syncDividendResult);
    await safeSync(3, 'MonthRevenue', syncMonthRevenue);
    await safeSync(3, 'CapitalReduction', syncCapitalReduction);
    await safeSync(3, 'SplitPrice', syncSplitPrice);
    await safeSync(3, 'ParValueChange', syncParValueChange);

    // Phase 4: 籌碼面逐股
    console.log('\n🔶 Phase 4: 籌碼面 (逐股)\n');
    await safeSync(4, 'MarginTrading', syncMarginTrading);
    await safeSync(4, 'Institutional', syncInstitutional);
    await safeSync(4, 'Shareholding', syncShareholding);
    await safeSync(4, 'SecuritiesLending', syncSecuritiesLending);
    await safeSync(4, 'ShortSaleSuspension', syncShortSaleSuspension);
    await safeSync(4, 'ShortSaleBalances', syncShortSaleBalances);

    // Phase 5: 衍生性逐商品
    console.log('\n🔶 Phase 5: 衍生性金融商品 (逐商品)\n');
    await safeSync(5, 'FuturesDaily', syncFuturesDaily);
    await safeSync(5, 'OptionDaily', syncOptionDaily);
    await safeSync(5, 'FuturesDealer', syncFuturesDealer);
    await safeSync(5, 'OptionDealer', syncOptionDealer);

    // Phase 6: 其他
    console.log('\n🔶 Phase 6: 其他\n');
    await safeSync(6, 'StockNews', syncStockNews);

    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log(`  ✅ 同步任務進度處理完成！本次耗時 ${elapsed} 分鐘`);
    console.log('═══════════════════════════════════════════════════');
}

// ========== Entry Point ==========
if (require.main === module) {
    require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

    syncAll()
        .then(async () => {
            console.log('🎉 Done!');
            await pool.end();
            process.exit(0);
        })
        .catch(async (err) => {
            console.error('❌ Fatal:', err);
            await pool.end();
            process.exit(1);
        });
}

module.exports = { syncAll, fetchFinMind, syncInstitutional };
