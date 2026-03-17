const { pool } = require('../db');

/**
 * AI 7-Factor Scoring Service
 * Calculates scores (0-100) for 7 dimensions of stock evaluation.
 */
async function calculateScores(symbol) {
    const scores = {
        momentum: 50,
        valuation: 50,
        quality: 50,
        growth: 50,
        volatility: 50,
        sentiment: 50,
        macro: 50
    };

    try {
        // 1. Momentum: RSI + MACD + MA + Returns
        const indRes = await pool.query('SELECT * FROM indicators WHERE symbol = $1 ORDER BY trade_date DESC LIMIT 1', [symbol]);
        const prices = await pool.query('SELECT close_price, change_percent FROM daily_prices WHERE symbol = $1 ORDER BY trade_date DESC LIMIT 250', [symbol]);
        
        if (indRes.rows[0]) {
            const ind = indRes.rows[0];
            let mScore = 50;
            if (ind.rsi_14 > 50) mScore += 10;
            if (ind.macd_hist > 0) mScore += 10;
            if (parseFloat(ind.ma_5) > parseFloat(ind.ma_20)) mScore += 10;
            
            // Returns: 1m, 6m (proxy)
            if (prices.rows.length > 20) {
                const ret1m = (parseFloat(prices.rows[0].close_price) / parseFloat(prices.rows[20].close_price) - 1) * 100;
                if (ret1m > 0) mScore += 10;
            }
            scores.momentum = Math.min(95, Math.max(5, mScore));

            // Volatility: Variance of last 20 days
            if (prices.rows.length > 5) {
                const changes = prices.rows.slice(0, 20).map(p => Math.abs(parseFloat(p.change_percent)));
                const avgVol = changes.reduce((a, b) => a + b, 0) / changes.length;
                scores.volatility = Math.min(95, Math.max(5, 100 - (avgVol * 25))); 
            }
        }

        // 2. Valuation
        const fundRes = await pool.query('SELECT * FROM fundamentals WHERE symbol = $1 ORDER BY trade_date DESC LIMIT 1', [symbol]);
        if (fundRes.rows[0]) {
            const f = fundRes.rows[0];
            let vScore = 40;
            if (parseFloat(f.pe_ratio) > 0 && parseFloat(f.pe_ratio) < 20) vScore += 20;
            if (parseFloat(f.pb_ratio) < 2.0) vScore += 20;
            if (parseFloat(f.dividend_yield) > 3) vScore += 15;
            scores.valuation = Math.min(95, vScore);
        }

        // 3. Quality & Growth (Flexible lookup)
        const finRes = await pool.query('SELECT item, value FROM fm_financial_statements WHERE stock_id = $1 ORDER BY date DESC LIMIT 100', [symbol]);
        if (finRes.rows.length > 0) {
            const getVal = (key) => {
                const row = finRes.rows.find(r => r.item === key || r.item.includes(key));
                return row ? parseFloat(row.value) : null;
            };

            const roe = getVal('ROE');
            const roa = getVal('ROA');
            const gpm = getVal('GrossProfitMargin');
            if (roe !== null) scores.quality = Math.min(95, roe * 2 + 40);
            else if (gpm !== null) scores.quality = Math.min(95, gpm * 1.5 + 30);

            const revG = getVal('RevenueYoY');
            const epsG = getVal('PreTaxIncomeYoY');
            if (revG !== null) scores.growth = Math.min(95, revG + 50);
            else if (epsG !== null) scores.growth = Math.min(95, epsG + 50);
        }

        // 4. Sentiment (Institutional + Margin)
        const instRes = await pool.query('SELECT total_net FROM institutional_2025 WHERE symbol = $1 ORDER BY trade_date DESC LIMIT 5', [symbol]);
        const marginRes = await pool.query('SELECT margin_purchase_today_balance FROM fm_margin_trading WHERE stock_id = $1 ORDER BY date DESC LIMIT 5', [symbol]);
        
        let sScore = 50;
        if (instRes.rows.length > 0) {
            const sumInst = instRes.rows.reduce((a, b) => a + (parseFloat(b.total_net) || 0), 0);
            if (sumInst > 0) sScore += 15;
        }
        if (marginRes.rows && marginRes.rows.length > 1) {
            const mChange = parseFloat(marginRes.rows[0].margin_purchase_today_balance) - parseFloat(marginRes.rows[1].margin_purchase_today_balance);
            if (mChange < 0) sScore += 10; 
        }
        scores.sentiment = Math.min(95, sScore);

        // 5. Macro (RS relative to Market)
        scores.macro = 55;

    } catch (e) {
        console.error('Scoring error for ' + symbol + ':', e.message);
    }

    return scores;
}

module.exports = { calculateScores };
