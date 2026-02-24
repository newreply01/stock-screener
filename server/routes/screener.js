const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/news - 獲取新聞
router.get('/news', async (req, res) => {
    try {
        const { category, limit = 10 } = req.query;
        let sql = 'SELECT * FROM news ';
        const params = [];

        if (category && category !== 'all' && category !== '') {
            sql += 'WHERE category = $1 ';
            params.push(category);
        }

        sql += 'ORDER BY publish_at DESC LIMIT $' + (params.length + 1);
        params.push(parseInt(limit));

        const result = await query(sql, params);
        res.json(result.rows);
    } catch (err) {
        console.error('獲取新聞失敗:', err);
        res.status(500).json({ error: '獲取新聞失敗' });
    }
});

// GET /api/screen - 股票篩選
router.get('/screen', async (req, res) => {
    try {
        console.log('🔍 [API] 收到篩選請求:', JSON.stringify(req.query));
        const {
            market,
            price_min, price_max,
            change_min, change_max,
            volume_min, volume_max,
            pe_min, pe_max,
            yield_min, yield_max,
            pb_min, pb_max,
            foreign_net_min, foreign_net_max,
            trust_net_min, trust_net_max,
            dealer_net_min, dealer_net_max,
            total_net_min, total_net_max,
            rsi_min, rsi_max,
            macd_hist_min, macd_hist_max,
            ma20_min, ma20_max,
            sort_by = 'volume',
            sort_dir = 'desc',
            page = 1,
            limit = 50,
            date,
            search,
            patterns
        } = req.query;

        // 取得交易日 (若無指定則取最新)
        let targetDate = date;
        if (!targetDate) {
            const latestDateResult = await query('SELECT MAX(trade_date) as latest FROM daily_prices');
            targetDate = latestDateResult.rows[0]?.latest;
        }

        if (!targetDate) {
            return res.json({ data: [], total: 0, page: 1, latestDate: null });
        }

        const conditions = [];
        const params = [];
        let paramIdx = 2; // $1 是 trade_date，從 $2 開始

        if (search) {
            conditions.push(`(s.symbol ILIKE $${paramIdx} OR s.name ILIKE $${paramIdx})`);
            params.push(`%${search}%`);
            paramIdx++;
        }

        // PostgreSQL 使用 $1, $2...

        if (market && market !== 'all') {
            conditions.push(`s.market = $${paramIdx++}`);
            params.push(market);
        }

        if (price_min) { conditions.push(`dp.close_price >= $${paramIdx++}`); params.push(parseFloat(price_min)); }
        if (price_max) { conditions.push(`dp.close_price <= $${paramIdx++}`); params.push(parseFloat(price_max)); }
        if (change_min) { conditions.push(`dp.change_percent >= $${paramIdx++}`); params.push(parseFloat(change_min)); }
        if (change_max) { conditions.push(`dp.change_percent <= $${paramIdx++}`); params.push(parseFloat(change_max)); }
        if (volume_min) { conditions.push(`dp.volume >= $${paramIdx++}`); params.push(parseInt(volume_min)); }
        if (volume_max) { conditions.push(`dp.volume <= $${paramIdx++}`); params.push(parseInt(volume_max)); }

        if (pe_min) { conditions.push(`f.pe_ratio >= $${paramIdx++}`); params.push(parseFloat(pe_min)); }
        if (pe_max) { conditions.push(`f.pe_ratio <= $${paramIdx++}`); params.push(parseFloat(pe_max)); }
        if (yield_min) { conditions.push(`f.dividend_yield >= $${paramIdx++}`); params.push(parseFloat(yield_min)); }
        if (yield_max) { conditions.push(`f.dividend_yield <= $${paramIdx++}`); params.push(parseFloat(yield_max)); }
        if (pb_min) { conditions.push(`f.pb_ratio >= $${paramIdx++}`); params.push(parseFloat(pb_min)); }
        if (pb_max) { conditions.push(`f.pb_ratio <= $${paramIdx++}`); params.push(parseFloat(pb_max)); }

        if (foreign_net_min) { conditions.push(`i.foreign_net >= $${paramIdx++}`); params.push(parseInt(foreign_net_min)); }
        if (foreign_net_max) { conditions.push(`i.foreign_net <= $${paramIdx++}`); params.push(parseInt(foreign_net_max)); }
        if (trust_net_min) { conditions.push(`i.trust_net >= $${paramIdx++}`); params.push(parseInt(trust_net_min)); }
        if (trust_net_max) { conditions.push(`i.trust_net <= $${paramIdx++}`); params.push(parseInt(trust_net_max)); }
        if (dealer_net_min) { conditions.push(`i.dealer_net >= $${paramIdx++}`); params.push(parseInt(dealer_net_min)); }
        if (dealer_net_max) { conditions.push(`i.dealer_net <= $${paramIdx++}`); params.push(parseInt(dealer_net_max)); }
        if (total_net_min) { conditions.push(`i.total_net >= $${paramIdx++}`); params.push(parseInt(total_net_min)); }
        if (total_net_max) { conditions.push(`i.total_net <= $${paramIdx++}`); params.push(parseInt(total_net_max)); }

        if (rsi_min) { conditions.push(`ind.rsi_14 >= $${paramIdx++}`); params.push(parseFloat(rsi_min)); }
        if (rsi_max) { conditions.push(`ind.rsi_14 <= $${paramIdx++}`); params.push(parseFloat(rsi_max)); }
        if (macd_hist_min) { conditions.push(`ind.macd_hist >= $${paramIdx++}`); params.push(parseFloat(macd_hist_min)); }
        if (macd_hist_max) { conditions.push(`ind.macd_hist <= $${paramIdx++}`); params.push(parseFloat(macd_hist_max)); }
        if (ma20_min) { conditions.push(`ind.ma_20 >= $${paramIdx++}`); params.push(parseFloat(ma20_min)); }
        if (ma20_max) { conditions.push(`ind.ma_20 <= $${paramIdx++}`); params.push(parseFloat(ma20_max)); }



        // --- NEW LOGIC: Pattern Detection ---
        let patternMatchedSymbols = null;
        if (patterns) {
            const requestedPatterns = patterns.split(',');
            console.log(`🔍 [API] 執行型態掃描: ${requestedPatterns.join(', ')}`);

            // 1. 取得最近三個交易日
            const datesRes = await query(`
                SELECT DISTINCT trade_date 
                FROM daily_prices 
                ORDER BY trade_date DESC LIMIT 3
            `);
            const recentDates = datesRes.rows.map(r => r.trade_date);

            if (recentDates.length === 3) {
                // 2. 取得所有股票這三日的收盤價
                const pricesRes = await query(`
                    SELECT symbol, trade_date, open_price, high_price, low_price, close_price 
                    FROM daily_prices 
                    WHERE trade_date = ANY($1)
                    ORDER BY symbol, trade_date DESC
                `, [recentDates]);

                const historyMap = {};
                pricesRes.rows.forEach(row => {
                    if (!historyMap[row.symbol]) historyMap[row.symbol] = [];
                    historyMap[row.symbol].push({
                        open: parseFloat(row.open_price),
                        close: parseFloat(row.close_price),
                        high: parseFloat(row.high_price),
                        low: parseFloat(row.low_price)
                    });
                });

                // 3. 型態偵測函數
                const detectPatterns = (ohlc) => {
                    if (!ohlc || ohlc.length < 3) return [];
                    const found = [];
                    const d0 = ohlc[0]; // 最新
                    const d1 = ohlc[1]; // 前一日
                    const d2 = ohlc[2]; // 前二日

                    // 多頭吞噬 (Bullish Engulfing)
                    if (d1.close < d1.open && d0.close > d0.open && d0.close > d1.open && d0.open < d1.close) {
                        found.push('bullish_engulfing');
                    }
                    // 空頭吞噬 (Bearish Engulfing)
                    if (d1.close > d1.open && d0.close < d0.open && d0.open > d1.close && d0.close < d1.open) {
                        found.push('bearish_engulfing');
                    }
                    // 晨星 (Morning Star) - 簡化版
                    if (d2.close < d2.open && Math.abs(d1.close - d1.open) < (d2.open - d2.close) * 0.3 && d0.close > d0.open && d0.close > d2.close) {
                        found.push('morning_star');
                    }
                    // 夜星 (Evening Star) - 簡化版
                    if (d2.close > d2.open && Math.abs(d1.close - d1.open) < (d2.close - d2.open) * 0.3 && d0.close < d0.open && d0.close < d2.open) {
                        found.push('evening_star');
                    }
                    // 紅三兵 (Red Three Soldiers)
                    if (d2.close > d2.open && d1.close > d1.open && d0.close > d0.open && d1.close > d2.close && d0.close > d1.close) {
                        found.push('red_three_soldiers');
                    }
                    // 三隻烏鴉 (Three Black Crows)
                    if (d2.close < d2.open && d1.close < d1.open && d0.close < d0.open && d1.close < d2.close && d0.close < d1.close) {
                        found.push('three_black_crows');
                    }

                    return found;
                };

                patternMatchedSymbols = [];
                for (const symbol in historyMap) {
                    const detected = detectPatterns(historyMap[symbol]);
                    if (requestedPatterns.some(p => detected.includes(p))) {
                        patternMatchedSymbols.push(symbol);
                    }
                }
                console.log(`🔍 [API] 型態符合檔數: ${patternMatchedSymbols.length}`);
            } else {
                patternMatchedSymbols = []; // 不足三天無法判斷
            }
        }

        // 如果有型態篩選，加入 WHERE 條件
        if (patternMatchedSymbols !== null) {
            if (patternMatchedSymbols.length === 0) {
                return res.json({ data: [], total: 0, page: 1, limit: parseInt(limit), totalPages: 0, latestDate: targetDate });
            }
            conditions.push(`s.symbol = ANY($${paramIdx++})`);
            params.push(patternMatchedSymbols);
        }

        const whereClause = conditions.length > 0
            ? 'AND ' + conditions.join(' AND ')
            : '';

        const sortableColumns = {
            symbol: 's.symbol',
            name: 's.name',
            close_price: 'dp.close_price',
            change_percent: 'dp.change_percent',
            volume: 'dp.volume',
            pe_ratio: 'f.pe_ratio',
            dividend_yield: 'f.dividend_yield',
            pb_ratio: 'f.pb_ratio',
            foreign_net: 'i.foreign_net',
            trust_net: 'i.trust_net',
            dealer_net: 'i.dealer_net',
            total_net: 'i.total_net'
        };

        const sortColumn = sortableColumns[sort_by] || 'dp.volume';
        const sortDirection = sort_dir === 'asc' ? 'ASC' : 'DESC';
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // 計算總數
        const countSQL = `
      SELECT COUNT(*) as total
      FROM stocks s
      JOIN daily_prices dp ON s.symbol = dp.symbol AND dp.trade_date = $1
      LEFT JOIN fundamentals f ON s.symbol = f.symbol AND f.trade_date = $1
      LEFT JOIN institutional i ON s.symbol = i.symbol AND i.trade_date = $1
      LEFT JOIN indicators ind ON s.symbol = ind.symbol AND ind.trade_date = $1
      WHERE 1=1 ${whereClause}
    `;
        const countResult = await query(countSQL, [targetDate, ...params]);
        const total = parseInt(countResult.rows[0].total);

        // 查詢資料
        const dataSQL = `
      SELECT
        s.symbol, s.name, s.market, s.industry,
        dp.open_price, dp.high_price, dp.low_price, dp.close_price,
        dp.change_amount, dp.change_percent, dp.volume, dp.trade_value, dp.transactions,
        f.pe_ratio, f.dividend_yield, f.pb_ratio,
        i.foreign_net, i.trust_net, i.dealer_net, i.total_net,
        i.foreign_buy, i.foreign_sell, i.trust_buy, i.trust_sell, i.dealer_buy, i.dealer_sell,
        ind.rsi_14, ind.macd_value, ind.macd_signal, ind.macd_hist, ind.ma_5, ind.ma_10, ind.ma_20, ind.ma_60
      FROM stocks s
      JOIN daily_prices dp ON s.symbol = dp.symbol AND dp.trade_date = $1
      LEFT JOIN fundamentals f ON s.symbol = f.symbol AND f.trade_date = $1
      LEFT JOIN institutional i ON s.symbol = i.symbol AND i.trade_date = $1
      LEFT JOIN indicators ind ON s.symbol = ind.symbol AND ind.trade_date = $1
      WHERE 1=1 ${whereClause}
      ORDER BY ${sortColumn} ${sortDirection} NULLS LAST
      LIMIT $${paramIdx++}::integer OFFSET $${paramIdx++}::integer
    `;

        const dataResult = await query(dataSQL, [targetDate, ...params, parseInt(limit), offset]);
        console.log(`🔍 [API] 查詢結果: ${dataResult.rows.length} 筆`);

        res.json({
            data: dataResult.rows,
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit)),
            latestDate: targetDate
        });
    } catch (err) {
        console.error('篩選 API 錯誤:', err);
        res.status(500).json({ error: '篩選失敗', message: err.message });
    }
});

// GET /api/stats - 市場統計
router.get('/stats', async (req, res) => {
    try {
        const { date } = req.query;
        let targetDate = date;

        if (!targetDate) {
            const latestDateResult = await query('SELECT MAX(trade_date) as latest FROM daily_prices');
            targetDate = latestDateResult.rows[0]?.latest;
        }

        if (!targetDate) {
            return res.json({ totalStocks: 0, latestDate: null });
        }

        const statsResult = await query(`
      SELECT
        COUNT(*) as total_stocks,
        COUNT(CASE WHEN dp.change_percent > 0 THEN 1 END) as up_count,
        COUNT(CASE WHEN dp.change_percent < 0 THEN 1 END) as down_count,
        COUNT(CASE WHEN dp.change_percent = 0 THEN 1 END) as flat_count,
        COUNT(CASE WHEN s.market = 'twse' THEN 1 END) as twse_count,
        COUNT(CASE WHEN s.market = 'tpex' THEN 1 END) as tpex_count
      FROM stocks s
      JOIN daily_prices dp ON s.symbol = dp.symbol AND dp.trade_date = $1
    `, [targetDate]);

        res.json({
            ...statsResult.rows[0],
            latestDate: targetDate
        });
    } catch (err) {
        console.error('統計 API 錯誤:', err);
        res.status(500).json({ error: '統計失敗' });
    }
});

// GET /api/stock/:symbol/financials - 個股財務歷史資料
router.get('/stock/:symbol/financials', async (req, res) => {
    try {
        const { symbol } = req.params;

        // 檢查是否已有資料，若無則嘗試同步 (On-demand sync)
        const checkRes = await query('SELECT symbol FROM monthly_revenue WHERE symbol = $1 LIMIT 1', [symbol]);
        if (checkRes.rows.length === 0) {
            console.log(`📡 [API] No financials for ${symbol}, triggering on-demand sync...`);
            const { syncStockFinancials } = require('../finmind_fetcher');
            await syncStockFinancials(symbol).catch(err => console.error('On-demand sync failed:', err));
        }

        // 1. 營收 (最近 36 個月)
        const revenueRes = await query(`
            SELECT revenue_year, revenue_month, revenue 
            FROM monthly_revenue 
            WHERE symbol = $1 
            ORDER BY revenue_year DESC, revenue_month DESC 
            LIMIT 36
        `, [symbol]);

        // 2. EPS (最近 12 季)
        const epsRes = await query(`
            SELECT date, value as eps 
            FROM financial_statements 
            WHERE symbol = $1 AND type = 'EPS'
            ORDER BY date DESC 
            LIMIT 12
        `, [symbol]);

        // 3. 股利 (最近 5 年)
        const dividendRes = await query(`
            SELECT year, total_dividend 
            FROM dividend_policy 
            WHERE symbol = $1 
            ORDER BY year DESC 
            LIMIT 5
        `, [symbol]);

        res.json({
            revenue: revenueRes.rows,
            eps: epsRes.rows,
            dividend: dividendRes.rows
        });
    } catch (err) {
        console.error('獲取財務資料失敗:', err);
        res.status(500).json({ error: '獲取財務資料失敗' });
    }
});

// GET /api/history/:symbol - 個股歷史 OHLCV 資料
router.get('/history/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { limit = 200 } = req.query; // 預設提供最新200天K線

        // 我們必須 Order By trade_date ASC 讓圖表由左至右畫
        const historySQL = `
            SELECT 
                TO_CHAR(trade_date, 'YYYY-MM-DD') as time,
                open_price as open, 
                high_price as high, 
                low_price as low, 
                close_price as close, 
                volume
            FROM daily_prices
            WHERE symbol = $1 AND open_price IS NOT NULL
            ORDER BY trade_date DESC
            LIMIT $2
        `;

        const result = await query(historySQL, [symbol, parseInt(limit)]);

        // 取得後反轉陣列，因為資料庫是拿最新的 N 筆，排圖表需要舊到新
        const orderedRows = result.rows.reverse();

        res.json(orderedRows);
    } catch (err) {
        console.error('獲取歷史價量失敗:', err);
        res.status(500).json({ error: '獲取歷史價量失敗' });
    }
});

// GET /api/compare - 多股歷史走勢比較
router.get('/compare', async (req, res) => {
    try {
        const { symbols, limit = 100 } = req.query; // symbols: '2330,2317,2454'
        if (!symbols) return res.status(400).json({ error: 'Missing symbols parameter' });

        const symbolList = symbols.split(',').map(s => s.trim()).filter(s => s.length > 0);
        if (symbolList.length === 0) return res.json({});

        // PostgreSQL IN 語法支援動態陣列，但為了防止 SQL Injection 及方便處理，我們動態產生占位符
        const placeholders = symbolList.map((_, i) => `$${i + 1}`).join(',');

        // 我們抓取這些股票最近 N 天的收盤價
        const sql = `
            SELECT 
                symbol,
                TO_CHAR(trade_date, 'YYYY-MM-DD') as time,
                close_price as close
            FROM daily_prices
            WHERE symbol IN (${placeholders}) AND close_price IS NOT NULL
            ORDER BY trade_date DESC
            LIMIT $${symbolList.length + 1}
        `;

        // 參數陣列: [...symbolList, limit * symbolList.length]
        // 確保每檔股票都有足夠天數，所以 limit 要乘以檔數
        const result = await query(sql, [...symbolList, parseInt(limit) * symbolList.length]);

        // 整理資料：將結果依據 symbol 進行分群，並反轉時間軸為舊到新
        // 另外，為了能在同一張圖上比較，計算每檔股票相對於「第一天」的累積報酬率 (base 100 or 0%)

        const grouped = {};
        symbolList.forEach(s => grouped[s] = []);

        result.rows.forEach(row => {
            if (grouped[row.symbol]) {
                grouped[row.symbol].push(row);
            }
        });

        const comparisonData = {};

        Object.keys(grouped).forEach(sym => {
            const series = grouped[sym].reverse(); // from oldest to newest
            if (series.length > 0) {
                const basePrice = Number(series[0].close);
                comparisonData[sym] = series.map(d => ({
                    time: d.time,
                    close: Number(d.close),
                    compare_percent: basePrice > 0 ? ((Number(d.close) - basePrice) / basePrice) * 100 : 0
                }));
            } else {
                comparisonData[sym] = [];
            }
        });

        res.json(comparisonData);
    } catch (err) {
        console.error('多股比較查詢失敗:', err);
        res.status(500).json({ error: '多股比較查詢失敗' });
    }
});

// GET /api/stock/:symbol/institutional - 個股法人買賣超歷史
router.get('/stock/:symbol/institutional', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { limit = 60 } = req.query;

        const sql = `
            SELECT 
                TO_CHAR(trade_date, 'YYYY-MM-DD') as date,
                foreign_net, trust_net, dealer_net, total_net,
                foreign_buy, foreign_sell, trust_buy, trust_sell, dealer_buy, dealer_sell
            FROM institutional
            WHERE symbol = $1
            ORDER BY trade_date DESC
            LIMIT $2
        `;

        const result = await query(sql, [symbol, parseInt(limit)]);
        res.json(result.rows.reverse()); // Reverse to get chronological order for charts
    } catch (err) {
        console.error('獲取法人籌碼失敗:', err);
        res.status(500).json({ error: '獲取法人籌碼失敗' });
    }
});

const { GoogleGenerativeAI } = require("@google/generative-ai");

// GET /api/stock/:symbol/ai-report - AI 智能分析報告
router.get('/stock/:symbol/ai-report', async (req, res) => {
    try {
        const { symbol } = req.params;

        // 1. 蒐集多維度資料 (價格、籌碼、新聞)
        const priceRes = await query(`
            SELECT close_price, change_percent, volume 
            FROM daily_prices 
            WHERE symbol = $1 
            ORDER BY trade_date DESC LIMIT 1
        `, [symbol]);

        const chipRes = await query(`
            SELECT total_net 
            FROM institutional 
            WHERE symbol = $1 
            ORDER BY trade_date DESC LIMIT 5
        `, [symbol]);

        const newsRes = await query(`
            SELECT title 
            FROM news 
            WHERE symbol = $1 OR symbol IS NULL -- 這裡簡化處理，實際可能需要關鍵字匹配
            ORDER BY publish_at DESC LIMIT 3
        `, [symbol]);

        const data = {
            price: priceRes.rows[0],
            chips: chipRes.rows,
            news: newsRes.rows
        };

        const totalChipNet = data.chips.reduce((a, b) => a + Number(b.total_net), 0);
        const priceSentiment = data.price?.change_percent > 0 ? '偏多' : '偏空';

        if (!process.env.GEMINI_API_KEY) {
            // Fallback: 智慧規則分析
            const fallbackReport = `【智能技術掃描】${symbol} 目前技術面呈現${priceSentiment}態勢。最新收盤價變動幅度為 ${data.price?.change_percent}%。籌碼面觀察，法人近五日累計買賣超約 ${totalChipNet.toLocaleString()} 張。結合最新新聞「${data.news[0]?.title || '無相關新聞'}」，建議短線投資者關注支撐位變動。請注意：系統尚未設定 GEMINI_API_KEY，此為基於量化規則之自動摘要。`;
            return res.json({
                report: fallbackReport,
                sentiment_score: data.price?.change_percent > 0 ? 0.65 : 0.35,
                is_fallback: true
            });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `你是一個專業的台股分析師。請針對股票代號 ${symbol} 提供一段約 250 字的專業分析報告。
        現有數據分析如下：
        - 當前價格狀態：漲跌幅 ${data.price?.change_percent}%
        - 近五日籌碼流向：法人合計買賣超 ${totalChipNet} 張
        - 近期新聞標題：${data.news.map(n => n.title).join(', ')}
        
        請包含以下內容：
        1. 技術面強弱總結
        2. 籌碼面法人動向分析
        3. 綜合投資建議
        4. 給出一個 0 到 1 之間的情緒分數 (0為極空, 1為極多)。
        
        請務必以 JSON 格式回應，不要包含 markdown 標記：{"report": "你的分析內容...", "sentiment_score": 0.XX}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        try {
            const jsonMatch = text.match(/\{.*\}/s);
            const reportData = jsonMatch ? JSON.parse(jsonMatch[0]) : { report: text, sentiment_score: 0.5 };
            res.json(reportData);
        } catch (e) {
            res.json({ report: text, sentiment_score: 0.5 });
        }
    } catch (err) {
        console.error('AI 報告生成失敗:', err);
        res.status(500).json({ error: 'AI 報告生成失敗' });
    }
});

module.exports = router;
