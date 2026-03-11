/**
 * 持倉分析 — 多因子評分引擎
 * 
 * 四大維度：技術面(30%), 基本面(25%), 籌碼面(25%), 動能面(20%)
 * 綜合分數 0~100
 *   >= 70 → 買進/加碼
 *   40~69 → 持有/觀望
 *   < 40  → 減碼/賣出
 */

const { query } = require('./db');

// ============ Helper: clamp score to 0~100 ============
function clamp(v, min = 0, max = 100) {
    return Math.max(min, Math.min(max, Math.round(v)));
}

// ============ 1. 技術面評分 (30%) ============
async function scoreTechnical(symbol) {
    const details = {};
    let total = 0;
    let count = 0;

    // Fetch latest indicator
    const indRes = await query(`
        SELECT * FROM indicators 
        WHERE symbol = $1 
        ORDER BY trade_date DESC LIMIT 1
    `, [symbol]);

    // Fetch latest price
    const priceRes = await query(`
        SELECT * FROM daily_prices
        WHERE symbol = $1
        ORDER BY trade_date DESC LIMIT 1
    `, [symbol]);

    if (indRes.rows.length === 0) return { score: 50, details: { note: '無技術指標資料' } };
    const ind = indRes.rows[0];
    const price = priceRes.rows.length > 0 ? priceRes.rows[0] : null;

    // 1a. RSI
    if (ind.rsi_14 !== null) {
        const rsi = parseFloat(ind.rsi_14);
        let rsiScore;
        if (rsi <= 30) rsiScore = 85 + (30 - rsi); // oversold = bullish
        else if (rsi >= 70) rsiScore = 15 - (rsi - 70); // overbought = bearish
        else rsiScore = 50 + ((50 - Math.abs(rsi - 50)) / 50) * 20; // neutral zone
        details.rsi = { value: rsi, score: clamp(rsiScore) };
        total += clamp(rsiScore);
        count++;
    }

    // 1b. MACD histogram
    if (ind.macd_hist !== null) {
        const hist = parseFloat(ind.macd_hist);
        let macdScore;
        if (hist > 0.5) macdScore = 75 + Math.min(hist * 5, 25);
        else if (hist > 0) macdScore = 55 + hist * 40;
        else if (hist > -0.5) macdScore = 45 + hist * 20;
        else macdScore = 25 - Math.min(Math.abs(hist) * 5, 25);
        details.macd = { value: hist, score: clamp(macdScore) };
        total += clamp(macdScore);
        count++;
    }

    // 1c. MA alignment (多頭/空頭排列)
    if (ind.ma_5 && ind.ma_10 && ind.ma_20 && ind.ma_60) {
        const ma5 = parseFloat(ind.ma_5), ma10 = parseFloat(ind.ma_10);
        const ma20 = parseFloat(ind.ma_20), ma60 = parseFloat(ind.ma_60);
        let maScore = 50;
        if (ma5 > ma10 && ma10 > ma20 && ma20 > ma60) maScore = 90; // 多頭排列
        else if (ma5 > ma10 && ma10 > ma20) maScore = 75;
        else if (ma5 < ma10 && ma10 < ma20 && ma20 < ma60) maScore = 10; // 空頭排列
        else if (ma5 < ma10 && ma10 < ma20) maScore = 25;
        details.maAlignment = { ma5, ma10, ma20, ma60, score: maScore };
        total += maScore;
        count++;
    }

    // 1d. Price vs MA20
    if (price && ind.ma_20) {
        const closePrice = parseFloat(price.close_price);
        const ma20 = parseFloat(ind.ma_20);
        const ratio = (closePrice - ma20) / ma20 * 100;
        let pvmaScore = 50 + ratio * 5;
        details.priceVsMa20 = { price: closePrice, ma20, ratio: ratio.toFixed(2), score: clamp(pvmaScore) };
        total += clamp(pvmaScore);
        count++;
    }

    // 1e. K-line patterns
    if (ind.patterns && Array.isArray(ind.patterns) && ind.patterns.length > 0) {
        const bullish = ['bullishengulfing', 'hammer', 'morningstar', 'threewhitesoldiers', 'piercingline'];
        const bearish = ['bearishengulfing', 'hangingman', 'eveningstar', 'threeblackcrows'];
        let patScore = 50;
        for (const p of ind.patterns) {
            if (bullish.includes(p)) patScore += 15;
            if (bearish.includes(p)) patScore -= 15;
        }
        details.patterns = { detected: ind.patterns, score: clamp(patScore) };
        total += clamp(patScore);
        count++;
    }

    return { score: count > 0 ? clamp(total / count) : 50, details };
}

// ============ 2. 基本面評分 (25%) ============
async function scoreFundamental(symbol) {
    const details = {};
    let total = 0;
    let count = 0;

    const funRes = await query(`
        SELECT * FROM fundamentals
        WHERE symbol = $1
        ORDER BY trade_date DESC LIMIT 1
    `, [symbol]);

    if (funRes.rows.length === 0) return { score: 50, details: { note: '無基本面資料' } };
    const f = funRes.rows[0];

    // 2a. PE ratio
    if (f.pe_ratio !== null && parseFloat(f.pe_ratio) > 0) {
        const pe = parseFloat(f.pe_ratio);
        let peScore;
        if (pe < 10) peScore = 90;
        else if (pe < 15) peScore = 75;
        else if (pe < 20) peScore = 60;
        else if (pe < 30) peScore = 40;
        else peScore = 20;
        details.pe = { value: pe, score: peScore };
        total += peScore;
        count++;
    }

    // 2b. PB ratio
    if (f.pb_ratio !== null && parseFloat(f.pb_ratio) > 0) {
        const pb = parseFloat(f.pb_ratio);
        let pbScore;
        if (pb < 1) pbScore = 90;
        else if (pb < 1.5) pbScore = 75;
        else if (pb < 3) pbScore = 55;
        else if (pb < 5) pbScore = 35;
        else pbScore = 15;
        details.pb = { value: pb, score: pbScore };
        total += pbScore;
        count++;
    }

    // 2c. Dividend yield
    if (f.dividend_yield !== null) {
        const dy = parseFloat(f.dividend_yield);
        let dyScore;
        if (dy > 7) dyScore = 95;
        else if (dy > 5) dyScore = 80;
        else if (dy > 3) dyScore = 60;
        else if (dy > 1) dyScore = 40;
        else dyScore = 20;
        details.dividendYield = { value: dy, score: dyScore };
        total += dyScore;
        count++;
    }

    // 2d. Monthly revenue YoY growth (from fm_month_revenue)
    try {
        const revRes = await query(`
            SELECT revenue, revenue_year, revenue_month
            FROM fm_month_revenue
            WHERE stock_id = $1
            ORDER BY revenue_year DESC, revenue_month DESC
            LIMIT 2
        `, [symbol]);
        if (revRes.rows.length >= 2) {
            const latest = parseFloat(revRes.rows[0].revenue);
            const prev = parseFloat(revRes.rows[1].revenue);
            if (prev > 0) {
                const growth = ((latest - prev) / prev) * 100;
                let growthScore;
                if (growth > 30) growthScore = 90;
                else if (growth > 15) growthScore = 75;
                else if (growth > 0) growthScore = 55;
                else if (growth > -15) growthScore = 35;
                else growthScore = 15;
                details.revenueGrowth = { value: growth.toFixed(2), score: growthScore };
                total += growthScore;
                count++;
            }
        }
    } catch (e) { /* optional data */ }

    return { score: count > 0 ? clamp(total / count) : 50, details };
}

// ============ 3. 籌碼面評分 (25%) ============
async function scoreChip(symbol) {
    const details = {};
    let total = 0;
    let count = 0;

    // 3a. Institutional investors (last 5 days net buy/sell)
    try {
        const instRes = await query(`
            SELECT name, SUM(buy - sell) as net
            FROM fm_institutional
            WHERE stock_id = $1
            AND date >= (SELECT MAX(date) - 5 FROM fm_institutional WHERE stock_id = $1)
            GROUP BY name
        `, [symbol]);

        let foreignNet = 0, trustNet = 0, dealerNet = 0;
        for (const row of instRes.rows) {
            const name = row.name;
            const net = parseInt(row.net) || 0;
            if (name.includes('外資') || name.includes('Foreign')) foreignNet += net;
            else if (name.includes('投信') || name.includes('Investment_Trust')) trustNet += net;
            else if (name.includes('自營') || name.includes('Dealer')) dealerNet += net;
        }

        const totalInst = foreignNet + trustNet + dealerNet;
        // Normalize to score: positive = bullish
        let instScore = 50 + Math.sign(totalInst) * Math.min(Math.abs(totalInst) / 500, 40);
        details.institutional = {
            foreign: foreignNet,
            trust: trustNet,
            dealer: dealerNet,
            total: totalInst,
            score: clamp(instScore)
        };
        total += clamp(instScore);
        count++;

        // Foreign investor score (separate)
        let foreignScore = 50 + Math.sign(foreignNet) * Math.min(Math.abs(foreignNet) / 500, 40);
        details.foreignFlow = { value: foreignNet, score: clamp(foreignScore) };
        total += clamp(foreignScore);
        count++;
    } catch (e) { /* optional */ }

    // 3b. Holding shares concentration (千張大戶)
    try {
        // level >= 15 is typically 1000+ shares holders
        const holdRes = await query(`
            SELECT h1.percent as latest_pct, h2.percent as prev_pct
            FROM (
                SELECT percent FROM fm_holding_shares_per
                WHERE stock_id = $1 AND level = 17
                ORDER BY date DESC LIMIT 1
            ) h1,
            (
                SELECT percent FROM fm_holding_shares_per
                WHERE stock_id = $1 AND level = 17
                ORDER BY date DESC LIMIT 1 OFFSET 1
            ) h2
        `, [symbol]);

        if (holdRes.rows.length > 0 && holdRes.rows[0].latest_pct !== null) {
            const latest = parseFloat(holdRes.rows[0].latest_pct);
            const prev = holdRes.rows[0].prev_pct ? parseFloat(holdRes.rows[0].prev_pct) : latest;
            const change = latest - prev;
            let holdScore = 50 + change * 10 + (latest > 50 ? 10 : 0);
            details.bigHolderPct = { latest, prev, change: change.toFixed(2), score: clamp(holdScore) };
            total += clamp(holdScore);
            count++;
        }
    } catch (e) { /* optional */ }

    // 3c. Margin trading analysis
    try {
        const marginRes = await query(`
            SELECT 
                margin_purchase_today_balance,
                margin_purchase_yesterday_balance,
                short_sale_today_balance,
                short_sale_yesterday_balance
            FROM fm_margin_trading
            WHERE stock_id = $1
            ORDER BY date DESC LIMIT 1
        `, [symbol]);

        if (marginRes.rows.length > 0) {
            const m = marginRes.rows[0];
            const marginChange = parseInt(m.margin_purchase_today_balance || 0) - parseInt(m.margin_purchase_yesterday_balance || 0);
            const shortChange = parseInt(m.short_sale_today_balance || 0) - parseInt(m.short_sale_yesterday_balance || 0);
            
            // Margin decrease + short increase = bullish for professionals
            let marginScore = 50;
            if (marginChange < 0) marginScore += 15; // 融資減
            if (marginChange > 0) marginScore -= 10; // 融資增
            if (shortChange > 0) marginScore += 10;  // 融券增 (空頭回補壓力)
            if (shortChange < 0) marginScore -= 5;
            
            // 券資比
            const marginBal = parseInt(m.margin_purchase_today_balance || 1);
            const shortBal = parseInt(m.short_sale_today_balance || 0);
            const ratio = marginBal > 0 ? (shortBal / marginBal * 100).toFixed(2) : 0;
            if (ratio > 20) marginScore += 10;

            details.margin = {
                marginChange,
                shortChange,
                ratioPercent: ratio,
                score: clamp(marginScore)
            };
            total += clamp(marginScore);
            count++;
        }
    } catch (e) { /* optional */ }

    return { score: count > 0 ? clamp(total / count) : 50, details };
}

// ============ 4. 動能面評分 (20%) ============
async function scoreMomentum(symbol) {
    const details = {};
    let total = 0;
    let count = 0;

    // Fetch last 20 daily prices
    const priceRes = await query(`
        SELECT trade_date, close_price, volume
        FROM daily_prices
        WHERE symbol = $1
        ORDER BY trade_date DESC
        LIMIT 20
    `, [symbol]);

    if (priceRes.rows.length < 5) return { score: 50, details: { note: '價格資料不足' } };
    const prices = priceRes.rows.map(r => ({ close: parseFloat(r.close_price), volume: parseInt(r.volume) }));

    // 4a. 5-day return
    const ret5 = ((prices[0].close - prices[4].close) / prices[4].close) * 100;
    let ret5Score = 50 + ret5 * 5;
    details.return5d = { value: ret5.toFixed(2), score: clamp(ret5Score) };
    total += clamp(ret5Score);
    count++;

    // 4b. 20-day return
    if (prices.length >= 20) {
        const ret20 = ((prices[0].close - prices[19].close) / prices[19].close) * 100;
        let ret20Score = 50 + ret20 * 3;
        details.return20d = { value: ret20.toFixed(2), score: clamp(ret20Score) };
        total += clamp(ret20Score);
        count++;
    }

    // 4c. Volume change (recent 5 days avg vs previous 5 days avg)
    if (prices.length >= 10) {
        const vol5 = prices.slice(0, 5).reduce((s, p) => s + p.volume, 0) / 5;
        const vol5prev = prices.slice(5, 10).reduce((s, p) => s + p.volume, 0) / 5;
        const volChange = vol5prev > 0 ? ((vol5 - vol5prev) / vol5prev) * 100 : 0;

        // Volume up + price up = bullish, volume up + price down = bearish
        let volScore = 50;
        const priceUp = prices[0].close > prices[4].close;
        if (volChange > 20 && priceUp) volScore = 80;
        else if (volChange > 0 && priceUp) volScore = 65;
        else if (volChange < -20 && !priceUp) volScore = 30; // 量縮價跌 moderate
        else if (volChange > 20 && !priceUp) volScore = 25; // 量增價跌 bad
        
        details.volumeChange = { value: volChange.toFixed(2), priceUp, score: clamp(volScore) };
        total += clamp(volScore);
        count++;
    }

    return { score: count > 0 ? clamp(total / count) : 50, details };
}

// ============ MAIN: Analyze a symbol ============
/**
 * @param {string} symbol - 股票代號
 * @param {object|null} customWeights - 自訂權重, e.g. { technical: 0.4, fundamental: 0.2, chip: 0.2, momentum: 0.2 }
 */
async function analyzePosition(symbol, customWeights = null) {
    const [technical, fundamental, chip, momentum] = await Promise.all([
        scoreTechnical(symbol),
        scoreFundamental(symbol),
        scoreChip(symbol),
        scoreMomentum(symbol)
    ]);

    // 預設權重，可被自訂權重覆蓋
    const defaultWeights = { technical: 0.30, fundamental: 0.25, chip: 0.25, momentum: 0.20 };
    const weights = customWeights ? {
        technical: customWeights.technical ?? defaultWeights.technical,
        fundamental: customWeights.fundamental ?? defaultWeights.fundamental,
        chip: customWeights.chip ?? defaultWeights.chip,
        momentum: customWeights.momentum ?? defaultWeights.momentum
    } : defaultWeights;

    // 確保權重總和為 1 (自動正規化)
    const wSum = weights.technical + weights.fundamental + weights.chip + weights.momentum;
    if (Math.abs(wSum - 1) > 0.01) {
        weights.technical /= wSum;
        weights.fundamental /= wSum;
        weights.chip /= wSum;
        weights.momentum /= wSum;
    }

    // Weighted composite
    const composite = clamp(
        technical.score * weights.technical +
        fundamental.score * weights.fundamental +
        chip.score * weights.chip +
        momentum.score * weights.momentum
    );

    // Generate recommendation
    let recommendation, signal;
    if (composite >= 75) { recommendation = '強力買進'; signal = 'STRONG_BUY'; }
    else if (composite >= 60) { recommendation = '買進/加碼'; signal = 'BUY'; }
    else if (composite >= 45) { recommendation = '持有/觀望'; signal = 'HOLD'; }
    else if (composite >= 30) { recommendation = '減碼/注意'; signal = 'SELL'; }
    else { recommendation = '建議賣出'; signal = 'STRONG_SELL'; }

    return {
        symbol,
        composite,
        signal,
        recommendation,
        dimensions: {
            technical: { score: technical.score, weight: weights.technical, details: technical.details },
            fundamental: { score: fundamental.score, weight: weights.fundamental, details: fundamental.details },
            chip: { score: chip.score, weight: weights.chip, details: chip.details },
            momentum: { score: momentum.score, weight: weights.momentum, details: momentum.details }
        },
        analyzedAt: new Date().toISOString()
    };
}

// Batch analyze: multiple symbols
async function analyzeMultiple(symbols, customWeights = null) {
    const results = [];
    for (const sym of symbols) {
        try {
            const result = await analyzePosition(sym, customWeights);
            results.push(result);
        } catch (err) {
            console.error(`Error analyzing ${sym}:`, err.message);
            results.push({ symbol: sym, composite: 0, signal: 'ERROR', recommendation: '分析失敗', error: err.message });
        }
    }
    // Sort by composite score descending
    results.sort((a, b) => b.composite - a.composite);
    return results;
}

module.exports = { analyzePosition, analyzeMultiple };
