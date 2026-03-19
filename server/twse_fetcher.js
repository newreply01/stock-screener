const { query } = require('./db');
const fetch = require('node-fetch');
const nodeFetch = fetch.default || fetch;

// 來源設定
const TWSE_MI_INDEX = 'https://www.twse.com.tw/exchangeReport/MI_INDEX?response=json&type=ALLBUT0999';
const TPEX_DAILY_URL = 'https://www.tpex.org.tw/web/stock/aftertrading/daily_close_quotes/stk_quote_result.php?l=zh-tw&o=json';
const TWSE_PE_URL = 'https://www.twse.com.tw/rwd/zh/afterTrading/BWIBBU_d?response=json';
const TPEX_PE_URL = 'https://www.tpex.org.tw/web/stock/aftertrading/peratio_analysis/pera_result.php?l=zh-tw&o=json';
const TWSE_INST_URL = 'https://www.twse.com.tw/rwd/zh/fund/T86?response=json&selectType=ALL';
const TPEX_INST_URL = 'https://www.tpex.org.tw/web/stock/3insti/daily_trade/3itrade_hedge_result.php?l=zh-tw&o=json&se=EW&t=D';
const TWSE_MARGIN_URL = 'https://www.twse.com.tw/exchangeReport/MI_MARGN?response=json&selectType=ALL';
const TPEX_MARGIN_URL = 'https://www.tpex.org.tw/web/stock/margin_trading/margin_sbl/margin_sbl_result.php?l=zh-tw&o=json';

// 工具函式
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const parseNumber = (str) => {
    if (!str || str === '--' || str === 'N/A' || str === '') return null;
    const cleaned = String(str).replace(/,/g, '').replace(/"/g, '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
};

// 日期格式化
const toDateStr = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
};
const toDateHyphen = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const toRocDate = (d) => { // 113/02/18
    const year = d.getFullYear() - 1911;
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
};

// 插入或更新 Stock (避免 FK 錯誤)
async function ensureStock(symbol, name = symbol) {
    await query(
        `INSERT INTO stocks (symbol, name) VALUES ($1, $2) ON CONFLICT (symbol) DO NOTHING`,
        [symbol, name]
    );
}

const fs = require('fs');
const path = require('path');
const { getTaiwanDate, formatTaiwanTime } = require('./utils/timeUtils');
const pool = require('./db').pool;

// 日誌記錄器
function logToFile(msg) {
    const timestamp = formatTaiwanTime();
    const logMsg = `[${timestamp}] ${msg}\n`;
    const logDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
    fs.appendFileSync(path.join(logDir, 'sync.log'), logMsg);
    console.log(msg);
}

// 更新同步進度 (用於系統監控)
async function updateProgress(dataset, stockId = '') {
    try {
        await query(
            `INSERT INTO fm_sync_progress (dataset, stock_id, last_sync_date, status)
             VALUES ($1, $2, NOW(), 'done')
             ON CONFLICT (dataset, stock_id) DO UPDATE SET last_sync_date = NOW(), status = 'done'`,
            [dataset, stockId]
        );
        logToFile(`[Progress] Updated ${dataset} ${stockId}`);
    } catch (e) {
        logToFile(`[Progress] Failed to update ${dataset}: ${e.message}`);
    }
}

// ===== 抓取上市 (TWSE) 歷史 =====
async function fetchTWSE(dateObj) {
    const dateStr = toDateStr(dateObj); // YYYYMMDD
    console.log(`[TWSE] 抓取 ${dateStr}...`);
    try {
        const url = `${TWSE_MI_INDEX}&date=${dateStr}`;
        const res = await nodeFetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' } });
        const json = await res.json();

        if (json.stat !== 'OK') {
            console.log(`[TWSE] ${dateStr} 無資料或休市: ${json.stat}`);
            return;
        }

        // --- 新增：記錄交易日 ---
        const tradeDateHyphen = toDateHyphen(dateObj);
        await query(
            `INSERT INTO trading_dates (date, description) VALUES ($1, '證交所交易日') ON CONFLICT (date) DO NOTHING`,
            [tradeDateHyphen]
        );
        await updateProgress('TaiwanStockTradingDate');

        const table = json.tables.find(t => t.title && t.title.includes('每日收盤行情'));

        // --- 新增：抓取大盤指數 ---
        const indexTable = json.tables.find(t => t.title && t.title.includes('價格指數'));
        if (indexTable && indexTable.data) {
            const taiexRow = indexTable.data.find(r => r[0] && r[0].includes('發行量加權股價指數'));
            if (taiexRow) {
                const taiexClose = parseNumber(taiexRow[1]);
                await ensureStock('TAIEX', '加權指數');
                await query(
                    `INSERT INTO daily_prices (symbol, trade_date, close_price, open_price, high_price, low_price)
                     VALUES ($1, $2, $3, $3, $3, $3)
                     ON CONFLICT (symbol, trade_date) DO UPDATE SET close_price = EXCLUDED.close_price`,
                    ['TAIEX', toDateHyphen(dateObj), taiexClose]
                );
                console.log(`[TWSE] ${dateStr} 大盤指數更新: ${taiexClose}`);
            }
        }

        if (!table) return;

        let count = 0;
        for (const row of table.data) {
            const symbol = row[0];
            const name = row[1];
            if (!/^(\d{4,5}|00\d{4})$/.test(symbol) && symbol !== 'TAIEX' && symbol !== 'IX0001') continue;

            await ensureStock(symbol, name);

            const volume = parseNumber(row[2]);
            const transactions = parseNumber(row[3]);
            const tradeValue = parseNumber(row[4]);
            const open = parseNumber(row[5]);
            const high = parseNumber(row[6]);
            const low = parseNumber(row[7]);
            const close = parseNumber(row[8]);

            let change = parseFloat(parseNumber(row[10]));
            if (row[9].includes('-')) change = -change;

            const changePercent = (close && change) ? (change / (close - change) * 100) : 0;

            await query(
                `INSERT INTO daily_prices (symbol, trade_date, open_price, high_price, low_price, close_price, change_amount, change_percent, volume, trade_value, transactions)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                 ON CONFLICT (symbol, trade_date) DO UPDATE SET
                   open_price=$3, close_price=$6, volume=$9`,
                [symbol, toDateHyphen(dateObj), open, high, low, close, change, changePercent, volume, tradeValue, transactions]
            );
            count++;
        }
        console.log(`[TWSE] ${dateStr} 更新 ${count} 筆`);
        if (count > 0) await updateProgress('TaiwanStockPrice');
    } catch (e) {
        console.error(`[TWSE] ${dateStr} 失敗:`, e.message);
    }
}

// ===== 抓取上櫃 (TPEx) 歷史 =====
async function fetchTPEx(dateObj) {
    const rocDate = toRocDate(dateObj); // 113/02/18
    console.log(`[TPEx] 抓取 ${rocDate}...`);
    try {
        const url = `${TPEX_DAILY_URL}&d=${rocDate}`;
        // Added User-Agent to avoid blocking
        const res = await nodeFetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' } });
        const json = await res.json();

        const dataRows = (json.tables && json.tables[0] && json.tables[0].data) ? json.tables[0].data : json.aaData;
        if (!dataRows || dataRows.length === 0) {
            console.log(`[TPEx] ${rocDate} 無資料`);
            return;
        }

        let count = 0;
        for (const row of dataRows) {
            const symbol = row[0];
            const name = row[1];
            if (!/^(\d{4,5}|00\d{4})$/.test(symbol)) continue;

            await ensureStock(symbol, name);
            await query(`INSERT INTO stocks (symbol, name, market) VALUES ($1, $2, 'tpex') ON CONFLICT (symbol) DO NOTHING`, [symbol, name]);

            const close = parseNumber(row[2]);
            const change = parseNumber(row[3]);
            const open = parseNumber(row[4]);
            const high = parseNumber(row[5]);
            const low = parseNumber(row[6]);

            // New format (tables[0].data) has an extra 'Avg Price' column at index 7.
            // Old format (aaData) was 16-17 cols, new is 19.
            const isNewFormat = row.length >= 19;
            const volume = parseNumber(isNewFormat ? row[8] : row[7]);
            const tradeValue = parseNumber(isNewFormat ? row[9] : row[8]);
            const transactions = parseNumber(isNewFormat ? row[10] : row[9]);

            const changePercent = (close && change) ? (change / (close - change) * 100) : 0;

            await query(
                `INSERT INTO daily_prices (symbol, trade_date, open_price, high_price, low_price, close_price, change_amount, change_percent, volume, trade_value, transactions)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                 ON CONFLICT (symbol, trade_date) DO NOTHING`,
                [symbol, toDateHyphen(dateObj), open, high, low, close, change, changePercent, volume, tradeValue, transactions]
            );
            count++;
        }
        console.log(`[TPEx] ${rocDate} 更新 ${count} 筆`);
        if (count > 0) await updateProgress('TaiwanStockPrice');
    } catch (e) {
        console.error(`[TPEx] ${rocDate} 失敗:`, e.message);
    }
}

// ===== 抓取基本面 (TWSE) 歷史 =====
async function fetchFundamentals(dateObj) {
    const dateStr = toDateStr(dateObj);
    const dateHyphen = toDateHyphen(dateObj);
    console.log(`[Fund] 抓取 ${dateStr}...`);
    try {
        const res = await nodeFetch(`${TWSE_PE_URL}&date=${dateStr}`, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' } });
        const json = await res.json();

        if (json.stat !== 'OK' || !json.data) return;

        const dyIdx = json.fields ? json.fields.indexOf("殖利率(%)") : 2;
        const peIdx = json.fields ? json.fields.indexOf("本益比") : 4;
        const pbIdx = json.fields ? json.fields.indexOf("股價淨值比") : 5;

        let count = 0;
        for (const row of json.data) {
            const symbol = row[0];
            if (!/^(\d{4,5}|00\d{4})$/.test(symbol)) continue;

            await ensureStock(symbol);

            const dividendYield = dyIdx !== -1 ? parseNumber(row[dyIdx]) : null;
            const peRatio = peIdx !== -1 ? parseNumber(row[peIdx]) : null;
            const pbRatio = pbIdx !== -1 ? parseNumber(row[pbIdx]) : null;

            await query(
                `INSERT INTO fundamentals (symbol, trade_date, pe_ratio, dividend_yield, pb_ratio)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (symbol, trade_date) DO UPDATE SET pe_ratio = EXCLUDED.pe_ratio, dividend_yield = EXCLUDED.dividend_yield, pb_ratio = EXCLUDED.pb_ratio`,
                [symbol, dateHyphen, peRatio, dividendYield, pbRatio]
            );
            count++;
        }
        console.log(`[Fund] ${dateStr} 更新 ${count} 筆`);
        if (count > 0) {
            await updateProgress('TaiwanStockFinancialStatements');
            await updateProgress('TaiwanStockTradingDate'); // 確保這也被標記為已更新
        }
    } catch (e) {
        console.error(`[Fund] ${dateStr} 失敗:`, e.message);
    }
}

// ===== 抓取基本面 (TPEx) 歷史 =====
async function fetchTPExFundamentals(dateObj) {
    const rocDate = toRocDate(dateObj);
    const dateHyphen = toDateHyphen(dateObj);
    console.log(`[TPEx-Fund] 抓取 ${rocDate}...`);
    try {
        const res = await nodeFetch(`${TPEX_PE_URL}&d=${rocDate}`, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' } });
        const json = await res.json();

        if (!json.tables || json.tables.length === 0) return;
        const table = json.tables[0];
        if (!table.data || table.data.length === 0) return;

        const dyIdx = table.fields ? table.fields.indexOf("殖利率(%)") : 5;
        const peIdx = table.fields ? table.fields.indexOf("本益比") : 2;
        const pbIdx = table.fields ? table.fields.indexOf("股價淨值比") : 6;

        let count = 0;
        for (const row of table.data) {
            const symbol = row[0];
            if (!/^\d{4,6}$/.test(symbol)) continue;

            await ensureStock(symbol);

            const dividendYield = dyIdx !== -1 ? parseNumber(row[dyIdx]) : null;
            const peRatio = peIdx !== -1 ? parseNumber(row[peIdx]) : null;
            const pbRatio = pbIdx !== -1 ? parseNumber(row[pbIdx]) : null;

            await query(
                `INSERT INTO fundamentals (symbol, trade_date, pe_ratio, dividend_yield, pb_ratio)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (symbol, trade_date) DO UPDATE SET pe_ratio = EXCLUDED.pe_ratio, dividend_yield = EXCLUDED.dividend_yield, pb_ratio = EXCLUDED.pb_ratio`,
                [symbol, dateHyphen, peRatio, dividendYield, pbRatio]
            );
            count++;
        }
        console.log(`[TPEx-Fund] ${rocDate} 更新 ${count} 筆`);
        if (count > 0) await updateProgress('TaiwanStockFinancialStatements');
    } catch (e) {
        console.error(`[TPEx-Fund] ${rocDate} 失敗:`, e.message);
    }
}

// ===== 抓取三大法人 (TWSE) 歷史 =====
async function fetchInstitutional(dateObj) {
    const dateStr = toDateStr(dateObj);
    const dateHyphen = toDateHyphen(dateObj);
    console.log(`[Inst] 抓取 ${dateStr}...`);
    try {
        const res = await nodeFetch(`${TWSE_INST_URL}&date=${dateStr}`, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' } });
        const json = await res.json();

        if (json.stat !== 'OK' || !json.data) {
            console.log(`[Inst] ${dateStr} 無資料或狀態不符: ${json.stat}`);
            return;
        }

        let count = 0;
        let skipCount = 0;
        for (const row of json.data) {
            const symbol = row[0].trim();
            // 放寬過濾條件，只要是數字開頭且長度 4-6 碼都抓
            if (!/^(\d{4,5}|00\d{4})$/.test(symbol)) {
                skipCount++;
                continue;
            }

            if (row.length < 19) {
                console.warn(`[Inst] ${dateStr} 股票 ${symbol} 資料欄位不足 (${row.length} 欄)`);
                continue;
            }

            await ensureStock(symbol);

            const foreignBuy = parseNumber(row[2]);
            const foreignSell = parseNumber(row[3]);
            const foreignNet = parseNumber(row[4]) + (parseNumber(row[7]) || 0);
            const trustBuy = parseNumber(row[8]);
            const trustSell = parseNumber(row[9]);
            const trustNet = parseNumber(row[10]);
            const dealerNet = parseNumber(row[11]);
            const dealerBuy = parseNumber(row[12]) + parseNumber(row[15]);
            const dealerSell = parseNumber(row[13]) + parseNumber(row[16]);
            const totalNet = parseNumber(row[18]);

            await query(
                `INSERT INTO institutional (symbol, trade_date, foreign_buy, foreign_sell, foreign_net, trust_buy, trust_sell, trust_net, dealer_buy, dealer_sell, dealer_net, total_net)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                 ON CONFLICT (symbol, trade_date) DO NOTHING`,
                [symbol, dateHyphen, foreignBuy, foreignSell, foreignNet, trustBuy, trustSell, trustNet, dealerBuy, dealerSell, dealerNet, totalNet]
            );
            count++;
        }
        console.log(`[Inst] ${dateStr} 更新 ${count} 筆 (過濾跳過 ${skipCount} 筆)`);
        if (count > 0) await updateProgress('TaiwanStockInstitutional');
    } catch (e) {
        console.error(`[Inst] ${dateStr} 失敗:`, e.message);
    }
}

// ===== 抓取三大法人 (TPEx) 歷史 =====
async function fetchTPExInstitutional(dateObj) {
    const rocDate = toRocDate(dateObj);
    const dateHyphen = toDateHyphen(dateObj);
    console.log(`[TPEx-Inst] 抓取 ${rocDate}...`);
    try {
        const url = `${TPEX_INST_URL}&d=${rocDate}`;
        const res = await nodeFetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' } });
        const text = await res.text();
        let json;
        try {
            json = JSON.parse(text);
        } catch (e) {
            console.error(`[TPEx-Inst] ${rocDate} JSON 解析失敗:`, e.message);
            console.log(`[TPEx-Inst] 回傳內容前 200 字: ${text.substring(0, 200)}`);
            return;
        }

        const dataRows = (json.tables && json.tables[0] && json.tables[0].data) ? json.tables[0].data : json.aaData;
        if (!dataRows || dataRows.length === 0) {
            console.log(`[TPEx-Inst] ${rocDate} 無資料`);
            return;
        }

        let count = 0;
        let skipCount = 0;
        for (const row of dataRows) {
            const symbol = row[0].trim();
            if (!/^(\d{4,5}|00\d{4})$/.test(symbol)) {
                skipCount++;
                continue;
            }

            await ensureStock(symbol);

            let foreignBuy, foreignSell, foreignNet, trustBuy, trustSell, trustNet, dealerBuy, dealerSell, dealerNet, totalNet;

            if (row.length >= 24) {
                foreignBuy = parseNumber(row[8]);
                foreignSell = parseNumber(row[9]);
                foreignNet = parseNumber(row[10]);
                trustBuy = parseNumber(row[11]);
                trustSell = parseNumber(row[12]);
                trustNet = parseNumber(row[13]);
                dealerBuy = parseNumber(row[20]);
                dealerSell = parseNumber(row[21]);
                dealerNet = parseNumber(row[22]);
                totalNet = parseNumber(row[23]);
            } else {
                foreignBuy = parseNumber(row[8]);
                foreignSell = parseNumber(row[9]);
                foreignNet = parseNumber(row[10]);
                trustBuy = parseNumber(row[11]);
                trustSell = parseNumber(row[12]);
                trustNet = parseNumber(row[13]);
                dealerBuy = parseNumber(row[14]);
                dealerSell = parseNumber(row[15]);
                dealerNet = parseNumber(row[16]);
                totalNet = parseNumber(row[19]);
            }

            await query(
                `INSERT INTO institutional (symbol, trade_date, foreign_buy, foreign_sell, foreign_net, trust_buy, trust_sell, trust_net, dealer_buy, dealer_sell, dealer_net, total_net)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                 ON CONFLICT (symbol, trade_date) DO NOTHING`,
                [symbol, dateHyphen, foreignBuy, foreignSell, foreignNet, trustBuy, trustSell, trustNet, dealerBuy, dealerSell, dealerNet, totalNet]
            );
            count++;
        }
        console.log(`[TPEx-Inst] ${rocDate} 更新 ${count} 筆 (過濾跳過 ${skipCount} 筆)`);
        if (count > 0) await updateProgress('TaiwanStockInstitutional');
    } catch (e) {
        console.error(`[TPEx-Inst] ${rocDate} 失敗:`, e.message);
    }
}

// ===== 抓取融資融券 (TWSE) 歷史 =====
async function fetchMarginTrading(dateObj) {
    const dateStr = toDateStr(dateObj);
    const dateHyphen = toDateHyphen(dateObj);
    console.log(`[Margin] 抓取 TWSE ${dateStr}...`);
    try {
        const res = await nodeFetch(`${TWSE_MARGIN_URL}&date=${dateStr}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const json = await res.json();
        if (json.stat !== 'OK' || !json.data) return;

        let count = 0;
        for (const row of json.data) {
            const symbol = row[0].trim();
            if (!/^\d{4,6}$/.test(symbol)) continue;

            await ensureStock(symbol);
            await query(`
                INSERT INTO fm_margin_trading (
                    stock_id, date, 
                    margin_purchase_buy, margin_purchase_sell, margin_purchase_cash_repayment, margin_purchase_yesterday_balance, margin_purchase_today_balance, margin_purchase_limit,
                    short_sale_buy, short_sale_sell, short_sale_cash_repayment, short_sale_yesterday_balance, short_sale_today_balance, short_sale_limit,
                    offsetting_margin_short
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                ON CONFLICT (stock_id, date) DO UPDATE SET
                    margin_purchase_buy = EXCLUDED.margin_purchase_buy,
                    margin_purchase_sell = EXCLUDED.margin_purchase_sell,
                    margin_purchase_today_balance = EXCLUDED.margin_purchase_today_balance,
                    short_sale_today_balance = EXCLUDED.short_sale_today_balance,
                    offsetting_margin_short = EXCLUDED.offsetting_margin_short
            `, [
                symbol, dateHyphen,
                parseNumber(row[2]), parseNumber(row[3]), parseNumber(row[4]), parseNumber(row[5]), parseNumber(row[6]), parseNumber(row[7]),
                parseNumber(row[8]), parseNumber(row[9]), parseNumber(row[10]), parseNumber(row[11]), parseNumber(row[12]), parseNumber(row[13]),
                parseNumber(row[14])
            ]);
            count++;
        }
        console.log(`[Margin] TWSE ${dateStr} 更新 ${count} 筆`);
        if (count > 0) await updateProgress('TaiwanStockMarginPurchaseShortSale');
    } catch (e) {
        console.error(`[Margin] TWSE ${dateStr} 失敗:`, e.message);
    }
}

// ===== 抓取融資融券 (TPEx) 歷史 =====
async function fetchTPExMarginTrading(dateObj) {
    const rocDate = toRocDate(dateObj);
    const dateHyphen = toDateHyphen(dateObj);
    console.log(`[Margin] 抓取 TPEx ${rocDate}...`);
    try {
        const res = await nodeFetch(`${TPEX_MARGIN_URL}&d=${rocDate}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const json = await res.json();
        const dataRows = (json.tables && json.tables[0] && json.tables[0].data) ? json.tables[0].data : json.aaData;
        if (!dataRows || dataRows.length === 0) return;

        let count = 0;
        for (const row of dataRows) {
            const symbol = row[0].trim();
            if (!/^\d{4,6}$/.test(symbol)) continue;

            await ensureStock(symbol);
            // TPEx indices: 4: M-Buy, 5: M-Sell, 6: M-Cash, 7: M-Prev, 8: M-Curr, 9: M-Limit
            // 10: S-Buy, 11: S-Sell, 12: S-Cash, 13: S-Prev, 14: S-Curr, 15: S-Limit, 16: Offset
            await query(`
                INSERT INTO fm_margin_trading (
                    stock_id, date, 
                    margin_purchase_buy, margin_purchase_sell, margin_purchase_cash_repayment, margin_purchase_yesterday_balance, margin_purchase_today_balance, margin_purchase_limit,
                    short_sale_buy, short_sale_sell, short_sale_cash_repayment, short_sale_yesterday_balance, short_sale_today_balance, short_sale_limit,
                    offsetting_margin_short
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                ON CONFLICT (stock_id, date) DO UPDATE SET
                    margin_purchase_buy = EXCLUDED.margin_purchase_buy,
                    margin_purchase_sell = EXCLUDED.margin_purchase_sell,
                    margin_purchase_today_balance = EXCLUDED.margin_purchase_today_balance,
                    short_sale_today_balance = EXCLUDED.short_sale_today_balance,
                    offsetting_margin_short = EXCLUDED.offsetting_margin_short
            `, [
                symbol, dateHyphen,
                parseNumber(row[4]), parseNumber(row[5]), parseNumber(row[6]), parseNumber(row[7]), parseNumber(row[8]), parseNumber(row[9]),
                parseNumber(row[10]), parseNumber(row[11]), parseNumber(row[12]), parseNumber(row[13]), parseNumber(row[14]), parseNumber(row[15]),
                parseNumber(row[16])
            ]);
            count++;
        }
        console.log(`[Margin] TPEx ${rocDate} 更新 ${count} 筆`);
        if (count > 0) await updateProgress('TaiwanStockMarginPurchaseShortSale');
    } catch (e) {
        console.error(`[Margin] TPEx ${rocDate} 失敗:`, e.message);
    }
}

// ===== 通用抓取區間迴圈 =====
async function fetchRange(startDate, endDate) {
    console.log(`📅 執行區間抓取: ${toDateHyphen(startDate)} -> ${toDateHyphen(endDate)}`);
    console.log(`🚀 開始從證交所/櫃買中心獲取歷史資料...`);
    let current = new Date(startDate);

    // Normalize time to avoid infinite loops due to DST/Timezone
    current.setHours(0, 0, 0, 0);
    let end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    while (current <= end) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            current.setDate(current.getDate() + 1);
            continue;
        }

        // 執行當日抓取
        await fetchTWSE(current);
        await sleep(1000);
        await fetchTPEx(current);
        await sleep(1000);
        await fetchFundamentals(current);
        await sleep(1000);
        await fetchTPExFundamentals(current);
        await sleep(1000);
        await fetchInstitutional(current);
        await sleep(1000);
        await fetchTPExInstitutional(current);
        await sleep(1000);
        await fetchMarginTrading(current);
        await sleep(1000);
        await fetchTPExMarginTrading(current);

        console.log(`⏳ 休眠 3 秒...`);
        await sleep(3000);

        current.setDate(current.getDate() + 1);
    }
    // 更新昨收快照
    await updateLastCloseSnapshot();
}

// ===== 更新昨收快照 (用於即時行情基準) =====
async function updateLastCloseSnapshot() {
    console.log(`🚀 [Snapshot] 正在更新昨收價快照表 (snapshot_last_close)...`);
    try {
        await query(`
            INSERT INTO snapshot_last_close (symbol, yest_close, today_close, last_update)
            WITH ranked_prices AS (
                SELECT 
                    symbol, 
                    close_price, 
                    trade_date,
                    ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY trade_date DESC) as rank
                FROM daily_prices
            )
            SELECT 
                t1.symbol,
                t2.close_price as yest_close,
                t1.close_price as today_close,
                t1.trade_date as last_update
            FROM ranked_prices t1
            LEFT JOIN ranked_prices t2 ON t1.symbol = t2.symbol AND t2.rank = 2
            WHERE t1.rank = 1
            ON CONFLICT (symbol) DO UPDATE SET
                yest_close = EXCLUDED.yest_close,
                today_close = EXCLUDED.today_close,
                last_update = EXCLUDED.last_update
        `);
        console.log(`✅ [Snapshot] 快照表更新完成！`);
    } catch (e) {
        console.error(`❌ [Snapshot] 快照表更新失敗:`, e.message);
    }
}

// ===== 主流程：自動補齊 =====
async function catchUp() {
    const today = getTaiwanDate();
    today.setHours(0, 0, 0, 0);
    console.log(`[CatchUp] Today is ${toDateHyphen(today)}`);
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(today.getFullYear() - 3);

    // 取得資料庫範圍
    let dbMin = null;
    let dbMax = null;
    try {
        const res = await query('SELECT MIN(trade_date) as min_date, MAX(trade_date) as max_date FROM daily_prices');
        if (res.rows.length > 0) {
            if (res.rows[0].min_date) dbMin = new Date(res.rows[0].min_date);
            if (res.rows[0].max_date) dbMax = new Date(res.rows[0].max_date);
        }
    } catch (e) {
        console.error('查詢日期範圍失敗:', e.message);
    }

    // 狀況 1: 資料庫全空 -> 從 3 年前抓到今天
    if (!dbMin) {
        console.log('⚠️ 資料庫為空，開始完整回補 3 年資料...');
        await fetchRange(threeYearsAgo, today);
        return;
    }

    // 狀況 2: 回補舊資料 (History Backfill)
    if (dbMin > threeYearsAgo) {
        // 設定回補結束點為 dbMin 的前一天
        const endBackfill = new Date(dbMin);
        endBackfill.setDate(endBackfill.getDate() - 1);

        // 確保範圍有效
        if (endBackfill >= threeYearsAgo) {
            console.log(`📉 發現舊資料缺漏 (DB始於 ${toDateHyphen(dbMin)})，開始回補 (${toDateHyphen(threeYearsAgo)} -> ${toDateHyphen(endBackfill)})...`);
            await fetchRange(threeYearsAgo, endBackfill);
        }
    }

    // 狀況 3: 補齊新資料 (New Data Catch-up)
    const normDbMax = new Date(dbMax); normDbMax.setHours(0, 0, 0, 0);
    const normToday = new Date(today); normToday.setHours(0, 0, 0, 0);

    if (normDbMax < today) {
        const startCatchUp = new Date(dbMax);
        startCatchUp.setDate(startCatchUp.getDate() + 1);
        console.log(`📈 發現新資料缺漏 (DB止於 ${toDateHyphen(dbMax)})，開始補齊 (${toDateHyphen(startCatchUp)} -> ${toDateHyphen(today)})...`);
        await fetchRange(startCatchUp, today);
    } else {
        console.log(`✅ 價格資料庫已包含今日數據 (${toDateHyphen(normDbMax)})，檢查籌碼資料...`);
        // 額外檢查籌碼資料是否落後
        try {
            const instRes = await query('SELECT MAX(trade_date) as max_date FROM institutional');
            const instMax = instRes.rows[0].max_date ? new Date(instRes.rows[0].max_date) : null;
            console.log(`[CatchUp] Inst Max Date: ${instMax ? toDateHyphen(instMax) : 'NULL'}`);
            if (!instMax || instMax < normDbMax) {
                const startInst = instMax ? new Date(instMax) : new Date(threeYearsAgo);
                if (instMax) startInst.setDate(startInst.getDate() + 1);
                console.log(`📊 發現籌碼資料落後，開始回補 (${toDateHyphen(startInst)} -> ${toDateHyphen(normDbMax)})...`);
                await fetchRange(startInst, normDbMax);
            }
        } catch (e) {
            console.error('檢查籌碼日期失敗:', e.message);
        }
    }

    console.log('🎉 所有資料檢查與補齊完成！');
    const finalCheck = await query('SELECT COUNT(*) as count, MAX(trade_date) as max_date FROM daily_prices');
    console.log(`📊 最終同步狀態: ${finalCheck.rows[0].count} 筆價格資料, 最新日期: ${finalCheck.rows[0].max_date}`);
}

if (require.main === module) {
    const { initDatabase } = require('./db');
    initDatabase()
        .then(() => catchUp())
        .then(() => process.exit(0))
        .catch(err => { console.error(err); process.exit(1); });
}

module.exports = { catchUp, fetchRange, fetchTWSE, fetchTPEx, updateLastCloseSnapshot };
