const express = require('express');
const router = express.Router();
const { query } = require('../db');

// 日期格式化助手 (解決時區偏移問題)
const formatLocalDate = (date) => {
    if (!date) return null;
    if (!(date instanceof Date)) {
        // 如果已經是字串，嘗試解析一下確保格式一致 (YYYY-MM-DD)
        const d = new Date(date);
        if (isNaN(d.getTime())) return date;
        date = d;
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// GET /api/screen - 篩選股票 (支持分頁與篩選)
router.get('/screen', async (req, res) => {
    try {
        const {
            search = '',
            industry = '',
            patterns = '',
            sort_by = 'volume',
            sort_dir = 'desc',
            page = 1,
            limit = 50,
            price_min, price_max,
            change_min, change_max,
            volume_min, volume_max,
            pe_min, pe_max,
            pb_min, pb_max,
            yield_min, yield_max,
            rsi_min, rsi_max,
            macd_hist_min, macd_hist_max,
            ma20_min, ma20_max,
            adx_min, adx_max,
            bb_width_min, bb_width_max,
            wpr_min, wpr_max,
            foreign_net_min, foreign_net_max,
            trust_net_min, trust_net_max,
            dealer_net_min, dealer_net_max,
            total_net_min, total_net_max,
            date,
            market,
            strategy,
            stock_types = 'stock' // 預設只顯示個股
        } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // 1. 為了效能，找出最近有完整交易資料的日期 (優化為單次查詢)
        const dateDetectionSql = `
            SELECT trade_date, count(*) as count
            FROM daily_prices
            WHERE trade_date IN (
                SELECT DISTINCT trade_date FROM daily_prices ORDER BY trade_date DESC LIMIT 5
            )
            AND symbol ~ '^[0-9]{4}$'
            GROUP BY trade_date
            ORDER BY trade_date DESC
        `;
        const detectedDatesRes = await query(dateDetectionSql);

        let latestDateRaw = null;
        for (const r of detectedDatesRes.rows) {
            if (parseInt(r.count) > 500) {
                latestDateRaw = r.trade_date;
                break;
            }
        }

        if (!latestDateRaw && detectedDatesRes.rows.length > 0) {
            latestDateRaw = detectedDatesRes.rows[0].trade_date;
        }

        if (!latestDateRaw) {
            return res.json({ success: true, data: [], total: 0, page: parseInt(page), totalPages: 0, latestDate: null });
        }

        // 如果使用者有指定日期，則以指定日期為基準
        if (date) {
            const requestedDate = new Date(date);
            if (!isNaN(requestedDate)) latestDateRaw = requestedDate;
        }

        let actualDate = latestDateRaw;
        // 如果基準日期的資料量不夠，再往前找最近一個完整的 (同樣利用已偵測的資料)
        for (const r of detectedDatesRes.rows) {
            if (r.trade_date <= latestDateRaw && parseInt(r.count) > 500) {
                actualDate = r.trade_date;
                break;
            }
        }

        const params = [actualDate];
        let paramCount = 2;
        let whereClause = `WHERE p.trade_date = $1`;

        if (search) {
            whereClause += ` AND (s.symbol ILIKE $${paramCount} OR s.name ILIKE $${paramCount})`;
            params.push(`%${search}%`);
            paramCount++;
        }

        if (industry && industry !== 'all') {
            whereClause += ` AND s.industry = $${paramCount}`;
            params.push(industry);
            paramCount++;
        }

        if (market && market !== 'all') {
            whereClause += ` AND s.market = $${paramCount}`;
            params.push(market);
            paramCount++;
        }

        // 標的類型過濾
        const types = (stock_types || 'stock').split(',');
        let typeConditions = [];
        if (types.includes('stock')) typeConditions.push("(s.symbol ~ '^[0-9]{4}$' AND s.symbol !~ '^00')");
        if (types.includes('etf')) typeConditions.push("(s.symbol ~ '^00' OR s.name ILIKE '%ETF%')");
        if (types.includes('warrant')) typeConditions.push("(s.symbol ~ '^[0-9]{6}$' AND s.symbol !~ '^00' AND s.symbol !~ '^02')");

        if (typeConditions.length > 0) {
            whereClause += ` AND (${typeConditions.join(' OR ')})`;
        }

        // 數字區間過濾函式
        const addRangeFilter = (col, min, max) => {
            if (min !== undefined && min !== '' && min !== null) {
                whereClause += ` AND ${col} >= $${paramCount}`;
                params.push(parseFloat(min));
                paramCount++;
            }
            if (max !== undefined && max !== '' && max !== null) {
                whereClause += ` AND ${col} <= $${paramCount}`;
                params.push(parseFloat(max));
                paramCount++;
            }
        };

        // 應用各項過濾
        addRangeFilter('p.close_price', price_min, price_max);
        addRangeFilter('p.change_percent', change_min, change_max);
        addRangeFilter('p.volume', volume_min, volume_max);
        addRangeFilter('f.pe_ratio', pe_min, pe_max);
        addRangeFilter('f.pb_ratio', pb_min, pb_max);
        addRangeFilter('f.dividend_yield', yield_min, yield_max);
        addRangeFilter('i.rsi_14', rsi_min, rsi_max);
        addRangeFilter('i.macd_hist', macd_hist_min, macd_hist_max);
        addRangeFilter('i.ma_20', ma20_min, ma20_max);
        // 暫時註解掉資料庫尚未存在的欄位
        // addRangeFilter('i.adx', adx_min, adx_max);
        // addRangeFilter('i.bb_width', bb_width_min, bb_width_max);
        // addRangeFilter('i.wpr', wpr_min, wpr_max);
        addRangeFilter('inst.foreign_net', foreign_net_min, foreign_net_max);
        addRangeFilter('inst.trust_net', trust_net_min, trust_net_max);
        addRangeFilter('inst.dealer_net', dealer_net_min, dealer_net_max);
        addRangeFilter('inst.total_net', total_net_min, total_net_max);

        // 智慧策略過濾
        if (strategy) {
            switch (strategy) {
                case 'bullish_ma': // 多頭排列
                    whereClause += ` AND i.ma_5 > i.ma_10 AND i.ma_10 > i.ma_20 AND i.ma_20 > i.ma_60 AND p.close_price > i.ma_5`;
                    break;
                case 'breakout': // 突破均線 (20MA)
                    whereClause += ` AND p.close_price > i.ma_20 AND p.open_price < i.ma_20 AND p.close_price > p.open_price`;
                    break;
                case 'high_yield': // 高殖利率
                    whereClause += ` AND f.dividend_yield > 5`;
                    break;
                case 'value_invest': // 價值投資
                    whereClause += ` AND f.pe_ratio > 0 AND f.pe_ratio < 15 AND f.pb_ratio > 0 AND f.pb_ratio < 1`;
                    break;
                case 'inst_buy': // 法人連買
                    whereClause += ` AND inst.foreign_net > 0 AND inst.trust_net > 0`;
                    break;
                case 'kenneth_fisher': // 肯尼斯·費雪 - 低 PE 成長
                    whereClause += ` AND f.pe_ratio > 0 AND f.pe_ratio < 15 AND p.change_percent > 0`;
                    break;
                case 'michael_price': // 麥克·喜偉 - 價值發現
                    whereClause += ` AND f.pb_ratio > 0 AND f.pb_ratio < 1.2 AND f.dividend_yield > 3`;
                    break;
                case 'warren_buffett': // 華倫·巴菲特 - 企業價值
                    whereClause += ` AND f.pe_ratio > 0 AND f.pe_ratio < 20 AND f.pb_ratio < 1.5 AND f.dividend_yield > 2`;
                    break;
                case 'benjamin_graham': // 班哲明·格拉罕 - 安全邊際
                    whereClause += ` AND f.pe_ratio > 0 AND f.pb_ratio > 0 AND (f.pe_ratio * f.pb_ratio) < 22.5`;
                    break;
                case 'peter_lynch': // 彼得·林區 - 盈餘增長 (以低PE+均線替代)
                    whereClause += ` AND f.pe_ratio > 0 AND f.pe_ratio < 12 AND p.close_price > i.ma_20`;
                    break;
                case 'michael_murphy': // 麥克·墨菲 - 科技成長 (強勢排列)
                    whereClause += ` AND i.ma_5 > i.ma_10 AND i.ma_10 > i.ma_20`;
                    break;
                case 'safe_dividend': // 安心存股 - 高殖利率
                    whereClause += ` AND f.dividend_yield > 5`;
                    break;
                case 'financial_giant': // 財務大腕 - 法人資金追捧
                    whereClause += ` AND inst.total_net > 1000 AND p.change_percent > 0`;
                    break;
            }
        }

        // K線型態過濾
        if (patterns) {
            const patternList = patterns.split(',').filter(Boolean);
            if (patternList.length > 0) {
                whereClause += ` AND (i.patterns ?| $${paramCount})`;
                params.push(patternList);
                paramCount++;
            }
        }

        console.log('Final SQL Params:', params);

        // 基本查詢語法 - 使用 LATERAL JOIN 優化獲取各標的最新關聯數據
        const baseQuery = `
            FROM stocks s
            JOIN daily_prices p ON s.symbol = p.symbol
            LEFT JOIN LATERAL (
                SELECT pe_ratio, pb_ratio, dividend_yield
                FROM fundamentals f_sub
                WHERE f_sub.symbol = s.symbol AND f_sub.trade_date <= $1::date
                ORDER BY f_sub.trade_date DESC
                LIMIT 1
            ) f ON true
            LEFT JOIN LATERAL (
                SELECT foreign_net, trust_net, dealer_net, total_net
                FROM institutional inst_sub
                WHERE inst_sub.symbol = s.symbol AND inst_sub.trade_date <= $1::date
                ORDER BY inst_sub.trade_date DESC
                LIMIT 1
            ) inst ON true
            LEFT JOIN LATERAL (
                SELECT patterns, rsi_14, macd_hist, ma_5, ma_10, ma_20, ma_60
                FROM indicators i_sub
                WHERE i_sub.symbol = s.symbol AND i_sub.trade_date <= $1::date
                ORDER BY i_sub.trade_date DESC
                LIMIT 1
            ) i ON true
            ${whereClause}
        `;

        // 獲取總數
        const countResult = await query(`SELECT COUNT(*) ${baseQuery}`, params);
        const total = parseInt(countResult.rows[0].count);

        // 獲取數據
        const dataSQL = `
            SELECT 
                s.symbol, s.name, s.industry, s.market,
                p.open_price, p.high_price, p.low_price, p.close_price, p.change_percent, p.volume,
                f.pe_ratio, f.pb_ratio, f.dividend_yield,
                inst.foreign_net, inst.trust_net, inst.dealer_net, inst.total_net,
                i.rsi_14, i.macd_hist, i.ma_20 as ma_20, i.patterns,
                p.trade_date::text as result_date
            ${baseQuery}
            ORDER BY ${sort_by === 'symbol' ? 's.symbol' : sort_by === 'name' ? 's.name' : 'p.' + sort_by} ${sort_dir}
            LIMIT $${paramCount} OFFSET $${paramCount + 1}
        `;
        params.push(parseInt(limit), offset);

        const dataResult = await query(dataSQL, params);

        // 返回前端預期的格式 - 使用本地日期字串避免時區偏離
        const displayDateStr = formatLocalDate(actualDate);

        res.json({
            success: true,
            data: dataResult.rows,
            total: total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            latestDate: displayDateStr
        });
    } catch (err) {
        console.error('Screener error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/stocks/industries - 取得所有產業清單
router.get('/stocks/industries', async (req, res) => {
    try {
        const sql = `
            SELECT DISTINCT industry 
            FROM stocks 
            WHERE industry IS NOT NULL AND industry != ''
            ORDER BY industry ASC
            `;
        const result = await query(sql);
        res.json(result.rows.map(row => row.industry));
    } catch (err) {
        console.error('Failed to fetch industries:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/market-summary - 獲取大盤分佈、產業排行與熱門股
router.get('/market-summary', async (req, res) => {
    try {
        const { market = 'all', stock_types = 'stock' } = req.query;

        // 1. 取得偵測日期 (找出最近有完整交易資料的日期)
        const dateDetectionSql = `
            SELECT trade_date, count(*) as count
            FROM daily_prices
            WHERE trade_date IN (
                SELECT DISTINCT trade_date FROM daily_prices ORDER BY trade_date DESC LIMIT 5
            )
            AND symbol ~ '^[0-9]{4}$'
            GROUP BY trade_date
            ORDER BY trade_date DESC
        `;
        const detectedDatesRes = await query(dateDetectionSql);

        let latestDateRaw = null;
        for (const r of detectedDatesRes.rows) {
            if (parseInt(r.count) > 500) {
                latestDateRaw = r.trade_date;
                break;
            }
        }

        if (!latestDateRaw && detectedDatesRes.rows.length > 0) {
            latestDateRaw = detectedDatesRes.rows[0].trade_date;
        }

        if (!latestDateRaw) {
            return res.json({ success: false, message: '無資料' });
        }

        const latestDate = latestDateRaw;
        const latestDateStr = formatLocalDate(latestDate);

        // 取得各市場獨立的最新日期 (用於排行榜)
        // 增加 threshold 並限制個股代號，防止權證大量成交導致日期誤跳
        const twseDateRes = await query(`
            SELECT p.trade_date as max_date 
            FROM daily_prices p 
            JOIN stocks s ON p.symbol = s.symbol 
            WHERE s.market = 'twse' AND p.volume > 0 AND s.symbol ~ '^[0-9]{4}$'
            GROUP BY p.trade_date
            HAVING count(*) > 200
            ORDER BY p.trade_date DESC LIMIT 1
        `);
        const tpexDateRes = await query(`
            SELECT p.trade_date as max_date 
            FROM daily_prices p 
            JOIN stocks s ON p.symbol = s.symbol 
            WHERE s.market = 'tpex' AND p.volume > 0 AND s.symbol ~ '^[0-9]{4}$'
            GROUP BY p.trade_date
            HAVING count(*) > 200
            ORDER BY p.trade_date DESC LIMIT 1
        `);

        const latestTwseDate = twseDateRes.rows[0]?.max_date || latestDate;
        const latestTpexDate = tpexDateRes.rows[0]?.max_date || latestDate;
        const latestTwseDateStr = formatLocalDate(latestTwseDate);
        const latestTpexDateStr = formatLocalDate(latestTpexDate);

        let whereClause = "WHERE p.trade_date = $1";
        const params = [latestDate];
        let paramCount = 2;

        if (market !== 'all') {
            whereClause += ` AND s.market = $${paramCount}`;
            params.push(market);
            paramCount++;
        }

        // 標的類型過濾
        const types = (stock_types || 'stock').split(',');
        let typeConditions = [];
        if (types.includes('stock')) typeConditions.push("(s.symbol ~ '^[0-9]{4}$' AND s.symbol !~ '^00')");
        if (types.includes('etf')) typeConditions.push("(s.symbol ~ '^00' OR s.name ILIKE '%ETF%')");
        if (types.includes('warrant')) typeConditions.push("(s.symbol ~ '^[0-9]{6}$' AND s.symbol !~ '^00' AND s.symbol !~ '^02')");

        const typeFilter = typeConditions.length > 0 ? `AND (${typeConditions.join(' OR ')})` : '';

        // 2. 漲跌分佈統計 (Histogram data)
        const distributionSql = `
        SELECT
        COUNT(*) filter(where change_percent >= 9.5) as limit_up,
            COUNT(*) filter(where change_percent >= 5 AND change_percent < 9.5) as up_5,
                COUNT(*) filter(where change_percent >= 2 AND change_percent < 5) as up_2_5,
                    COUNT(*) filter(where change_percent > 0 AND change_percent < 2) as up_0_2,
                        COUNT(*) filter(where change_percent = 0) as flat,
                            COUNT(*) filter(where change_percent > -2 AND change_percent < 0) as down_0_2,
                                COUNT(*) filter(where change_percent > -5 AND change_percent <= -2) as down_2_5,
                                    COUNT(*) filter(where change_percent > -9.5 AND change_percent <= -5) as down_5,
                                        COUNT(*) filter(where change_percent <= -9.5) as limit_down
            FROM daily_prices p
            JOIN stocks s ON p.symbol = s.symbol
            ${whereClause} ${typeFilter}
        `;
        const distResult = await query(distributionSql, params);

        // 3. 產業績效排行 (Industry Performance)
        const industrySql = `
        SELECT
        s.industry,
            AVG(p.change_percent) as avg_change,
            COUNT(*) as stock_count
            FROM daily_prices p
            JOIN stocks s ON p.symbol = s.symbol
            ${whereClause} AND s.industry IS NOT NULL AND s.industry != '' ${typeFilter}
            GROUP BY s.industry
            ORDER BY avg_change DESC
            LIMIT 20
            `;
        const industryResult = await query(industrySql, params);

        // 4-9. 並行執行排行榜查詢 (Parallel execution)
        const [
            twseResult,
            tpexResult,
            twseGainersResult,
            twseLosersResult,
            tpexGainersResult,
            tpexLosersResult
        ] = await Promise.all([
            query(`
                SELECT s.symbol, s.name, p.close_price, p.change_percent, p.volume, TO_CHAR(p.trade_date, 'YYYY-MM-DD') as date
                FROM daily_prices p
                JOIN stocks s ON p.symbol = s.symbol
                WHERE p.trade_date = $1 AND s.market = 'twse' ${typeFilter}
                ORDER BY p.volume DESC LIMIT 10
            `, [latestTwseDate]),
            query(`
                SELECT s.symbol, s.name, p.close_price, p.change_percent, p.volume, TO_CHAR(p.trade_date, 'YYYY-MM-DD') as date
                FROM daily_prices p
                JOIN stocks s ON p.symbol = s.symbol
                WHERE p.trade_date = $1 AND s.market = 'tpex' ${typeFilter}
                ORDER BY p.volume DESC LIMIT 10
            `, [latestTpexDate]),
            query(`
                SELECT s.symbol, s.name, p.close_price, p.change_amount, p.volume
                FROM daily_prices p
                JOIN stocks s ON p.symbol = s.symbol
                WHERE p.trade_date = $1 AND s.market = 'twse' AND p.change_amount IS NOT NULL ${typeFilter}
                ORDER BY p.change_amount DESC LIMIT 10
            `, [latestTwseDate]),
            query(`
                SELECT s.symbol, s.name, p.close_price, p.change_amount, p.volume
                FROM daily_prices p
                JOIN stocks s ON p.symbol = s.symbol
                WHERE p.trade_date = $1 AND s.market = 'twse' AND p.change_amount IS NOT NULL ${typeFilter}
                ORDER BY p.change_amount ASC LIMIT 10
            `, [latestTwseDate]),
            query(`
                SELECT s.symbol, s.name, p.close_price, p.change_amount, p.volume
                FROM daily_prices p
                JOIN stocks s ON p.symbol = s.symbol
                WHERE p.trade_date = $1 AND s.market = 'tpex' AND p.change_amount IS NOT NULL ${typeFilter}
                ORDER BY p.change_amount DESC LIMIT 10
            `, [latestTpexDate]),
            query(`
                SELECT s.symbol, s.name, p.close_price, p.change_amount, p.volume
                FROM daily_prices p
                JOIN stocks s ON p.symbol = s.symbol
                WHERE p.trade_date = $1 AND s.market = 'tpex' AND p.change_amount IS NOT NULL ${typeFilter}
                ORDER BY p.change_amount ASC LIMIT 10
            `, [latestTpexDate])
        ]);

        res.json({
            success: true,
            latestDate: latestDateStr,
            marketDates: {
                twse: latestTwseDateStr,
                tpex: latestTpexDateStr
            },
            distribution: distResult.rows[0],
            industries: industryResult.rows,
            twseVolume: twseResult.rows,
            tpexVolume: tpexResult.rows,
            twseGainers: twseGainersResult.rows,
            twseLosers: twseLosersResult.rows,
            tpexGainers: tpexGainersResult.rows,
            tpexLosers: tpexLosersResult.rows
        });
    } catch (err) {
        console.error('Market summary error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/stats
router.get('/stats', async (req, res) => {
    try {
        // 先取得最新日期 (快速，利用索引)
        const dateRes = await query("SELECT trade_date FROM daily_prices ORDER BY trade_date DESC LIMIT 1");
        const latestDate = dateRes.rows[0]?.trade_date;

        if (!latestDate) return res.json({});

        const sql = `
        SELECT
            COUNT(*) filter(where change_percent > 0) as up_count,
            COUNT(*) filter(where change_percent < 0) as down_count,
            COUNT(*) filter(where change_percent = 0) as flat_count,
            AVG(change_percent) as avg_change,
            TO_CHAR($1::date, 'YYYY-MM-DD') as "latestDate"
        FROM daily_prices
        WHERE trade_date = $1
        `;
        const result = await query(sql, [latestDate]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/news
router.get('/news', async (req, res) => {
    try {
        const { category = 'headline', limit = 10 } = req.query;
        const sql = `
            SELECT news_id, category, title, summary, image_url, publish_at
            FROM news
            WHERE category = $1
            ORDER BY publish_at DESC
            LIMIT $2
    `;
        const result = await query(sql, [category, parseInt(limit)]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/history/:symbol
router.get('/history/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { limit = 200, period = '日K' } = req.query;

        if (period === '週K' || period === '月K') {
            const dateTrunc = period === '週K' ? 'week' : 'month';
            const sql = `
SELECT
TO_CHAR(DATE_TRUNC($3, trade_date), 'YYYY-MM-DD') as time,
    (ARRAY_AGG(open_price ORDER BY trade_date ASC))[1] as open,
    MAX(high_price) as high,
    MIN(low_price) as low,
    (ARRAY_AGG(close_price ORDER BY trade_date DESC))[1] as close,
    SUM(volume) as volume
                FROM daily_prices
                WHERE symbol = $1 AND open_price IS NOT NULL
                GROUP BY DATE_TRUNC($3, trade_date)
                ORDER BY DATE_TRUNC($3, trade_date) DESC
                LIMIT $2
    `;
            const result = await query(sql, [symbol, parseInt(limit), dateTrunc]);
            return res.json(result.rows.reverse());
        }

        const sql = `
SELECT
TO_CHAR(trade_date, 'YYYY-MM-DD') as time,
    open_price as open, high_price as high, low_price as low, close_price as close, volume
            FROM daily_prices
            WHERE symbol = $1 AND open_price IS NOT NULL
            ORDER BY trade_date DESC LIMIT $2
    `;
        const result = await query(sql, [symbol, parseInt(limit)]);
        res.json(result.rows.reverse());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/stock/:symbol/news - 個股新聞 (FinMind)
router.get('/stock/:symbol/news', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { limit = 10 } = req.query;

        const sql = `
SELECT
stock_id,
    TO_CHAR(date, 'YYYY-MM-DD') as date,
    title,
    source,
    description as summary
            FROM fm_stock_news
            WHERE stock_id = $1
            ORDER BY date DESC, title ASC
            LIMIT $2
        `;

        const result = await query(sql, [symbol, parseInt(limit)]);
        const news = result.rows.map((row, idx) => ({
            news_id: `fm - ${row.stock_id} -${row.date} -${idx} `,
            title: row.title,
            summary: row.summary,
            publish_at: row.date,
            source: row.source
        }));

        res.json(news);
    } catch (err) {
        console.error('Failed to fetch stock news:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/stock/:symbol/financials
router.get('/stock/:symbol/financials', async (req, res) => {
    try {
        const { symbol } = req.params;

        // Parallel queries for better performance
        const [fundamentals, monthlyRevenue, eps, dividends, balanceSheet, incomeStatement, cashFlow, ratios] = await Promise.all([
            query('SELECT * FROM fundamentals WHERE symbol = $1', [symbol]),
            query('SELECT * FROM monthly_revenue WHERE symbol = $1 ORDER BY revenue_year DESC, revenue_month DESC LIMIT 12', [symbol]),
            query('SELECT * FROM financial_statements WHERE symbol = $1 AND type = $2 ORDER BY date DESC LIMIT 8', [symbol, 'EPS']),
            query('SELECT year as date, year, cash_dividend as cash_earnings_distribution, stock_dividend as stock_earnings_distribution FROM dividend_policy WHERE symbol = $1 ORDER BY year DESC LIMIT 20', [symbol]),
            query('SELECT type as item, value, date FROM fm_financial_statements WHERE stock_id = $1 AND item = $2 ORDER BY date DESC LIMIT 1000', [symbol, 'Balance Sheet']),
            query('SELECT type as item, value, date FROM fm_financial_statements WHERE stock_id = $1 AND item = $2 ORDER BY date DESC LIMIT 1000', [symbol, 'Income Statement']),
            query('SELECT type as item, value, date FROM fm_financial_statements WHERE stock_id = $1 AND item = $2 ORDER BY date DESC LIMIT 1000', [symbol, 'Cash Flows']),
            query(`
SELECT * FROM fm_financial_statements 
                WHERE stock_id = $1 
                AND item IN('GrossProfitMargin', 'OperatingIncomeMargin', 'NetIncomeMargin', 'ROE', 'ROA')
                ORDER BY date DESC LIMIT 40
    `, [symbol])
        ]);

        res.json({
            info: fundamentals.rows[0] || null,
            revenue: monthlyRevenue.rows || [],
            eps: eps.rows || [],
            dividends: dividends.rows || [],
            statements: {
                balanceSheet: balanceSheet.rows || [],
                incomeStatement: incomeStatement.rows || [],
                cashFlow: cashFlow.rows || []
            },
            ratios: ratios.rows || []
        });
    } catch (err) {
        console.error('Error fetching financials:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/institutional-rank - 三大法人排行
router.get('/institutional-rank', async (req, res) => {
    try {
        const { type = 'foreign', range = '3d', action = 'buy' } = req.query;
        const isSell = action === 'sell';

        // 映射類型到欄位
        const fieldMap = {
            'foreign': 'foreign_net',
            'investment': 'trust_net',
            'dealer': 'dealer_net'
        };
        const field = fieldMap[type] || 'foreign_net';

        // 映射範圍到天數
        const rangeMap = { '3d': 3, '5d': 5, '10d': 10 };
        const days = rangeMap[range] || 3;

        // 取得最近的 N 個有效交易日 (加入門檻防止髒數據)
        const datesRes = await query(`
            SELECT trade_date 
            FROM institutional 
            GROUP BY trade_date
            HAVING count(*) > 5000
            ORDER BY trade_date DESC 
            LIMIT $1`, [days]);

        if (datesRes.rows.length === 0) {
            return res.json({ success: true, data: [] });
        }

        const targetDates = datesRes.rows.map(r => r.trade_date);

        // 彙總排行
        const sql = `
SELECT
i.symbol,
    s.name,
    s.industry,
    s.market,
    SUM(i.${field}:: numeric / 1000.0) as net_buy
            FROM institutional i
            JOIN stocks s ON i.symbol = s.symbol
            WHERE i.trade_date = ANY($1::date[])
            GROUP BY i.symbol, s.name, s.industry, s.market
            HAVING SUM(i.${field}) ${isSell ? '< 0' : '> 0'}
            ORDER BY net_buy ${isSell ? 'ASC' : 'DESC'}
            LIMIT 20
    `;

        const result = await query(sql, [targetDates]);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Institutional rank error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});



// GET /api/market-stats - 市場統計 (用於頁首)
router.get('/market-stats', async (req, res) => {
    try {
        const dateRes = await query(`
            SELECT trade_date 
            FROM daily_prices 
            GROUP BY trade_date
            HAVING count(*) > 500
            ORDER BY trade_date DESC LIMIT 1
        `);
        const latestDate = dateRes.rows[0]?.trade_date;

        if (!latestDate) return res.json({});

        const sql = `
        SELECT
            COUNT(*) filter(where change_percent > 0) as up_count,
            COUNT(*) filter(where change_percent < 0) as down_count,
            TO_CHAR($1::date, 'YYYY-MM-DD') as latestDate
        FROM daily_prices
        WHERE trade_date = $1
        `;
        const result = await query(sql, [latestDate]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/stock/:symbol/institutional', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { limit = 60 } = req.query;
        const sql = `
SELECT
TO_CHAR(trade_date, 'YYYY-MM-DD') as date,
    (total_net / 1000.0) as total_net,
    (foreign_net / 1000.0) as foreign_net,
    (trust_net / 1000.0) as trust_net,
    (dealer_net / 1000.0) as dealer_net
            FROM institutional WHERE symbol = $1 ORDER BY trade_date DESC LIMIT $2
    `;
        const result = await query(sql, [symbol, parseInt(limit)]);
        res.json(result.rows.reverse());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/stocks/search - Autocomplete Search
router.get('/stocks/search', async (req, res) => {
    try {
        const { q = '', limit = 10 } = req.query;
        if (!q) return res.json([]);

        const sql = `
SELECT
s.symbol, s.name, s.industry, s.market,
    p.close_price, p.change_percent,
    f.pe_ratio, f.pb_ratio, f.dividend_yield,
    inst.foreign_net / 1000.0 as foreign_net,
    inst.trust_net / 1000.0 as trust_net,
    inst.dealer_net / 1000.0 as dealer_net
            FROM stocks s
            LEFT JOIN LATERAL(
        SELECT close_price, change_percent
                FROM daily_prices dp
                WHERE dp.symbol = s.symbol
                ORDER BY trade_date DESC
                LIMIT 1
    ) p ON true
            LEFT JOIN LATERAL(
        SELECT pe_ratio, pb_ratio, dividend_yield
                FROM fundamentals
                WHERE symbol = s.symbol
                ORDER BY trade_date DESC
                LIMIT 1
    ) f ON true
            LEFT JOIN LATERAL(
        SELECT foreign_net, trust_net, dealer_net
                FROM institutional
                WHERE symbol = s.symbol
                ORDER BY trade_date DESC
                LIMIT 1
    ) inst ON true
            WHERE s.symbol LIKE $1 OR s.name LIKE $1
            ORDER BY
CASE 
                    WHEN s.symbol = $2 THEN 0
                    WHEN s.name = $2 THEN 1
                    WHEN s.symbol LIKE $3 THEN 2
                    WHEN s.name LIKE $3 THEN 3
                    ELSE 4
END,
    s.symbol ASC
            LIMIT $4
    `;
        const result = await query(sql, [`%${q}%`, q, `${q}%`, parseInt(limit)]);
        res.json(result.rows);
    } catch (err) {
        console.error('Failed to search stocks:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/debug/sync-status - 診斷資料同步狀態
router.get('/debug/sync-status', async (req, res) => {
    try {
        const stocksCount = await query('SELECT COUNT(*) FROM stocks');
        const priceCount = await query('SELECT COUNT(*) FROM daily_prices');
        const dateRange = await query('SELECT MIN(trade_date) as min_date, MAX(trade_date) as max_date FROM daily_prices');
        const instCount = await query('SELECT COUNT(*) FROM institutional');

        res.json({
            success: true,
            counts: {
                stocks: stocksCount.rows[0].count,
                daily_prices: priceCount.rows[0].count,
                institutional: instCount.rows[0].count
            },
            dateRange: dateRange.rows[0],
            message: priceCount.rows[0].count > 0 ? '資料同步中...' : '資料庫為空或同步尚未開始'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/stock/:symbol/broker-trading - 主力分點進出 (最新一日)
router.get('/stock/:symbol/broker-trading', async (req, res) => {
    try {
        const { symbol } = req.params;

        // 1. 取得該股最新有分點資料的日期
        const dateRes = await query("SELECT TO_CHAR(MAX(date), 'YYYY-MM-DD') as max_date, MAX(date) as original_date FROM fm_broker_trading WHERE stock_id = $1", [symbol]);
        const latestDateStr = dateRes.rows[0].max_date;
        const latestDate = dateRes.rows[0].original_date;

        if (!latestDate) {
            return res.json({ success: true, data: [], date: null });
        }

        // 2. 彙總該日買超與賣超前 15 名
        const sql = `
SELECT
broker as name,
    buy as buy_vol,
    sell as sell_vol,
    (buy - sell) as net_vol
            FROM fm_broker_trading
            WHERE stock_id = $1 AND date = $2
            ORDER BY ABS(buy - sell) DESC
            LIMIT 30
    `;
        const result = await query(sql, [symbol, latestDate]);

        // 將結果分為買方與賣方
        const brokers = result.rows;

        // 如果是週K或月K，我們通常返回該期間內「彙總」的買賣超，或者該期間最後一天的明細
        // 這裡暫時維持返回最新一天的明細，但未來可以根據需求進行期間彙總
        const buyers = brokers.filter(b => b.net_vol > 0).sort((a, b) => b.net_vol - a.net_vol).slice(0, 15);
        const sellers = brokers.filter(b => b.net_vol < 0).sort((a, b) => a.net_vol - b.net_vol).slice(0, 15);

        res.json({
            success: true,
            date: latestDateStr,
            period: req.query.period || '日K',
            buyers,
            sellers
        });
    } catch (err) {
        console.error('Failed to fetch broker trading:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/stock/:symbol/margin-trading - 融資融券趨勢
router.get('/stock/:symbol/margin-trading', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { limit = 60 } = req.query;

        const sql = `
SELECT
TO_CHAR(date, 'YYYY-MM-DD') as date,
    margin_purchase_today_balance as margin_balance,
    short_sale_today_balance as short_balance,
    margin_purchase_buy,
    margin_purchase_sell,
    short_sale_buy,
    short_sale_sell
            FROM fm_margin_trading
            WHERE stock_id = $1
            ORDER BY date DESC
            LIMIT $2
    `;
        const result = await query(sql, [symbol, parseInt(limit)]);
        res.json({ success: true, data: result.rows.reverse() });
    } catch (err) {
        console.error('Failed to fetch margin trading:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/stock/:symbol/broker-trace - 主力進跡 (趨勢)
router.get('/stock/:symbol/broker-trace', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { limit = 60, period = '日K' } = req.query;

        let dateTrunc = 'day';
        if (period === '週K') dateTrunc = 'week';
        if (period === '月K') dateTrunc = 'month';

        const sql = `
            WITH daily_brokers AS(
        SELECT 
                    date,
        (buy - sell) as net_vol,
        ROW_NUMBER() OVER(PARTITION BY date ORDER BY ABS(buy - sell) DESC) as rank
                FROM fm_broker_trading
                WHERE stock_id = $1
    ),
    daily_main_net AS(
        SELECT 
                    date,
        SUM(net_vol) as main_net_vol
                FROM daily_brokers
                WHERE rank <= 15
                GROUP BY date
    )
SELECT
TO_CHAR(DATE_TRUNC($3, date), 'YYYY-MM-DD') as date,
    SUM(main_net_vol) as main_net_vol
            FROM daily_main_net
            GROUP BY DATE_TRUNC($3, date)
            ORDER BY DATE_TRUNC($3, date) DESC
            LIMIT $2
        `;
        const result = await query(sql, [symbol, parseInt(limit), dateTrunc]);
        res.json({ success: true, data: result.rows.reverse(), period });
    } catch (err) {
        console.error('Failed to fetch broker trace:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

const https = require('https');
const fetchJson = (url) => new Promise((resolve, reject) => {
    https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
        });
    }).on('error', reject);
});

// GET /api/realtime/:symbol - 獲取即時行情 (代理 TWSE MIS)
router.get('/realtime/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;

        // 1. 先確認該檔股票是上市(twse)還是上櫃(tpex)
        const marketRes = await query('SELECT market FROM stocks WHERE symbol = $1', [symbol]);
        const market = marketRes.rows[0]?.market === 'twse' ? 'tse' : 'otc';

        // 2. 向臺灣證券交易所 MIS 系統發起請求
        // ex_ch=tse_2330.tw
        const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${market}_${symbol}.tw`;
        const misData = await fetchJson(url);

        if (!misData || !misData.msgArray || misData.msgArray.length === 0) {
            return res.json({ success: false, message: '無即時報價資料' });
        }

        const info = misData.msgArray[0];

        // 解析資料 (格式參考 TWSE JSON，欄位皆為字串)
        // z: 最近成交價, tv: 當盤成交量, v: 累積成交量, y: 昨收
        // b: 買價五檔 (以 _ 分隔), g: 買量五檔
        // a: 賣價五檔, f: 賣量五檔
        const parseFiveLevels = (pricesStr, volsStr) => {
            if (!pricesStr || !volsStr) return [];
            const prices = pricesStr.split('_').filter(Boolean);
            const vols = volsStr.split('_').filter(Boolean);
            return prices.map((p, i) => ({
                price: p === '-' ? null : parseFloat(p),
                volume: vols[i] ? parseInt(vols[i]) : 0
            })).filter(level => level.price !== null);
        };

        const bids = parseFiveLevels(info.b, info.g);
        const asks = parseFiveLevels(info.a, info.f);

        // 將五檔整合為一組陣列，供前端對齊渲染 (最多五檔)
        const bidAskData = [];
        for (let i = 0; i < 5; i++) {
            bidAskData.push({
                bid: bids[i]?.price || null,
                bVol: bids[i]?.volume || null,
                ask: asks[i]?.price || null,
                aVol: asks[i]?.volume || null
            });
        }

        // 處理盤中暫停交易、收盤前試算撮合所導致的 z="-" 問題，改用 pz (simulated match price)
        const rawZ = (info.z && info.z !== '-') ? info.z : ((info.pz && info.pz !== '-') ? info.pz : null);
        const z = rawZ ? parseFloat(rawZ) : null;
        const y = parseFloat(info.y);
        const change = (z !== null && !isNaN(y)) ? (z - y) : 0;
        const changePercent = (z !== null && !isNaN(y) && y !== 0) ? (change / y) * 100 : 0;

        // 大致推算內外盤比例 (這只是粗略推估，不是精確值)
        // 假設最新價貼近買價=內盤(Sell intensity)，貼近賣價=外盤(Buy intensity)
        let buyIntensity = 50;
        let sellIntensity = 50;
        if (asks.length > 0 && bids.length > 0 && z) {
            const bestBid = bids[0].price;
            const bestAsk = asks[0].price;
            if (z >= bestAsk) { buyIntensity = 65; sellIntensity = 35; }
            else if (z <= bestBid) { buyIntensity = 35; sellIntensity = 65; }
        }

        res.json({
            success: true,
            symbol: info.c,
            name: info.n,
            last_price: z,
            previous_close: y,
            change: change,
            change_percent: changePercent,
            volume: isNaN(parseInt(info.v)) ? null : parseInt(info.v),
            trade_volume: isNaN(parseInt(info.tv)) ? null : parseInt(info.tv),
            open: isNaN(parseFloat(info.o)) ? null : parseFloat(info.o),
            high: isNaN(parseFloat(info.h)) ? null : parseFloat(info.h),
            low: isNaN(parseFloat(info.l)) ? null : parseFloat(info.l),
            latest_time: info.t,
            buy_intensity: buyIntensity,
            sell_intensity: sellIntensity,
            five_levels: bidAskData
        });
    } catch (err) {
        console.error('Failed to fetch realtime data:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/market-focus - 市場焦點個股 (WantGoo style)
router.get('/market-focus', async (req, res) => {
    try {
        const { market = 'all', stock_types = 'stock' } = req.query;

        // 1. 先嘗試從預先計算的資料表讀取
        const cacheSql = `
            SELECT trade_date, turnover, hot, foreign3d, trust3d, main3d
            FROM market_focus_daily
            WHERE market = $1 AND stock_types = $2
            ORDER BY trade_date DESC LIMIT 1
        `;
        const cacheRes = await query(cacheSql, [market, stock_types]);

        // 如果資料庫有預算資料，直接返回
        if (cacheRes.rows.length > 0) {
            const row = cacheRes.rows[0];
            return res.json({
                success: true,
                latestDate: row.trade_date,
                data: {
                    turnover: row.turnover,
                    hot: row.hot,
                    foreign3d: row.foreign3d,
                    trust3d: row.trust3d,
                    main3d: row.main3d
                }
            });
        }

        // --- 防呆機制 (Fallback)：如果無快取或尚未預先計算，退回即時計算邏輯 ---
        console.log(`[Market Focus API] Cache miss for market=${market} types=${stock_types}, executing live calc.`);

        // 取得最新有足夠資料的交易日與前三個交易日
        const dateDetectionSql = `
            SELECT trade_date, count(*) as count
            FROM daily_prices
            WHERE symbol ~ '^[0-9]{4}$'
            GROUP BY trade_date
            HAVING count(*) > 1500
            ORDER BY trade_date DESC
            LIMIT 3
        `;
        const datesRes = await query(dateDetectionSql);

        if (datesRes.rows.length === 0) {
            const fallbackRes = await query('SELECT DISTINCT trade_date FROM daily_prices ORDER BY trade_date DESC LIMIT 3');
            if (fallbackRes.rows.length === 0) return res.json({ success: false, message: '無資料' });
            datesRes.rows = fallbackRes.rows;
        }

        const latestDate = datesRes.rows[0].trade_date;
        const targetDates = datesRes.rows.map(r => r.trade_date);

        const types = (stock_types || 'stock').split(',');
        let typeConditions = [];
        if (types.includes('stock')) typeConditions.push("(s.symbol ~ '^[0-9]{4}$' AND s.symbol !~ '^00')");
        if (types.includes('etf')) typeConditions.push("(s.symbol ~ '^00' OR s.name ILIKE '%ETF%')");
        if (types.includes('warrant')) typeConditions.push("(s.symbol ~ '^[0-9]{6}$' AND s.symbol !~ '^00' AND s.symbol !~ '^02')");

        const typeFilter = typeConditions.length > 0 ? `AND (${typeConditions.join(' OR ')})` : '';
        const marketFilter = market !== 'all' ? `AND s.market = '${market}'` : '';

        const [turnoverRes, hotRes, instRes] = await Promise.all([
            query(`
                SELECT s.symbol, s.name, p.close_price, p.change_percent, (p.volume * p.close_price) as turnover
                FROM daily_prices p
                JOIN stocks s ON p.symbol = s.symbol
                WHERE p.trade_date = $1 ${marketFilter} ${typeFilter}
                ORDER BY turnover DESC NULLS LAST
                LIMIT 10
            `, [latestDate]),
            query(`
                SELECT s.symbol, s.name, p.close_price, p.change_percent, p.volume
                FROM daily_prices p
                JOIN stocks s ON p.symbol = s.symbol
                WHERE p.trade_date = $1 ${marketFilter} ${typeFilter}
                ORDER BY p.volume DESC NULLS LAST
                LIMIT 10
            `, [latestDate]),
            query(`
                SELECT i.symbol, s.name, 
                       MAX(p.close_price) as close_price, 
                       MAX(p.change_percent) as change_percent,
                       SUM(i.foreign_net) as foreign_buy,
                       SUM(i.trust_net) as trust_buy,
                       SUM(i.total_net) as total_buy
                FROM institutional i
                JOIN stocks s ON i.symbol = s.symbol
                JOIN daily_prices p ON p.symbol = i.symbol AND p.trade_date = $1
                WHERE i.trade_date = ANY($2) ${marketFilter} ${typeFilter}
                GROUP BY i.symbol, s.name
            `, [latestDate, targetDates])
        ]);

        const foreignRes = [...instRes.rows].sort((a, b) => b.foreign_buy - a.foreign_buy).slice(0, 10);
        const trustRes = [...instRes.rows].sort((a, b) => b.trust_buy - a.trust_buy).slice(0, 10);
        const totalRes = [...instRes.rows].sort((a, b) => b.total_buy - a.total_buy).slice(0, 10);

        // 可以在這裡選擇寫入防呆的計算結果，但目前交給每日排程處理即可
        const { calculateMarketFocus } = require('../scripts/calc_market_focus');
        calculateMarketFocus(market, stock_types).catch(e => console.error('Background calc failed:', e));

        res.json({
            success: true,
            latestDate,
            data: {
                turnover: turnoverRes.rows,
                hot: hotRes.rows,
                foreign3d: foreignRes,
                trust3d: trustRes,
                main3d: totalRes
            }
        });

    } catch (err) {
        console.error('Market focus error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/market-margin - 大盤融資融券餘額 (WantGoo style)
router.get('/market-margin', async (req, res) => {
    try {
        // 從資料庫撈取最後60筆融資餘額、融券餘額與真實大盤指數
        // 使用 DATE(m.date) = DATE(p.trade_date) 來忽略時分秒差異
        const marginSql = `
            SELECT 
                DATE(m.date) as trade_date, 
                MAX(CASE WHEN m.name IN ('MarginPurchaseMoney', 'MarginPurchase') THEN m.margin_purchase_today_balance ELSE 0 END) as margin_balance,
                MAX(CASE WHEN m.name IN ('MarginShortMoney', 'ShortSale') THEN m.margin_purchase_today_balance ELSE 0 END) as short_balance,
                p.close_price as index_price
            FROM fm_total_margin m
            LEFT JOIN daily_prices p 
                ON DATE(m.date) = DATE(p.trade_date) AND (p.symbol = 'TAIEX' OR p.symbol = 'TSE' OR p.symbol = 'TWII')
            WHERE m.name IN ('MarginPurchaseMoney', 'MarginPurchase', 'MarginShortMoney', 'ShortSale')
            GROUP BY DATE(m.date), p.close_price
            ORDER BY trade_date DESC
            LIMIT 60
        `;
        const marginRes = await query(marginSql);

        if (marginRes.rows.length === 0) {
            return res.json({ success: false, message: '無大盤融資融券資料' });
        }

        // 轉換資料，融券若以張數(ShortSale)計則目前僅為估計，若以金額(MarginShortMoney)計則需處理單位
        const chartData = marginRes.rows.reverse().map(row => {
            let s_bal = parseFloat(row.short_balance);
            // 啟發式判斷：如果 short_balance 小於 margin_balance 的 1/1000，很可能是單位不同或是以張數計
            // 這裡假設若為 MarginShortMoney (千元)，則乘以 1000 轉為元
            if (s_bal > 0 && s_bal < parseFloat(row.margin_balance) / 100) {
                s_bal = s_bal * 1000;
            }

            return {
                trade_date: row.trade_date,
                margin_balance: row.margin_balance,
                short_balance: s_bal,
                index_price: row.index_price
            };
        });

        res.json({
            success: true,
            data: chartData
        });

    } catch (err) {
        console.error('Market margin error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ========== Yahoo VIP-Style Features ==========

// GET /api/stock/:symbol/health-check - 個股健診 (六大指標雷達圖)
router.get('/stock/:symbol/health-check', async (req, res) => {
    try {
        const { symbol } = req.params;

        // Parallel fetch all required data
        const [fundamentalRes, grossProfitRes, revenueStatRes, revenueRes, epsRes, instRes, dividendRes, priceRes, equityRes] = await Promise.all([
            query('SELECT pe_ratio, pb_ratio, dividend_yield FROM fundamentals WHERE symbol = $1 ORDER BY trade_date DESC LIMIT 1', [symbol]),
            query(`SELECT value, date FROM fm_financial_statements WHERE stock_id = $1 AND type = 'GrossProfit' ORDER BY date DESC LIMIT 4`, [symbol]),
            query(`SELECT value, date FROM fm_financial_statements WHERE stock_id = $1 AND type = 'Revenue' ORDER BY date DESC LIMIT 4`, [symbol]),
            query('SELECT revenue, revenue_year, revenue_month FROM monthly_revenue WHERE symbol = $1 ORDER BY revenue_year DESC, revenue_month DESC LIMIT 24', [symbol]),
            query("SELECT value, date FROM financial_statements WHERE symbol = $1 AND type = 'EPS' ORDER BY date DESC LIMIT 8", [symbol]),
            query('SELECT foreign_net, trust_net, total_net FROM institutional WHERE symbol = $1 ORDER BY trade_date DESC LIMIT 10', [symbol]),
            query('SELECT year, cash_dividend, stock_dividend FROM dividend_policy WHERE symbol = $1 ORDER BY year DESC LIMIT 5', [symbol]),
            query('SELECT close_price, change_percent FROM daily_prices WHERE symbol = $1 ORDER BY trade_date DESC LIMIT 1', [symbol]),
            query(`SELECT value, date FROM fm_financial_statements WHERE stock_id = $1 AND type = 'Equity' ORDER BY date DESC LIMIT 4`, [symbol])
        ]);

        const fund = fundamentalRes.rows[0] || {};
        const pe = parseFloat(fund.pe_ratio) || 0;
        const pb = parseFloat(fund.pb_ratio) || 0;
        const dy = parseFloat(fund.dividend_yield) || 0;
        const closePrice = parseFloat(priceRes.rows[0]?.close_price) || 0;

        // --- 1. Profitability Score (獲利能力) ---
        // Calculate Gross Margin from raw data
        const grossProfit = grossProfitRes.rows.length > 0 ? parseFloat(grossProfitRes.rows[0].value) : 0;
        const revenueStat = revenueStatRes.rows.length > 0 ? parseFloat(revenueStatRes.rows[0].value) : 0;
        const latestGrossMargin = (revenueStat > 0 && grossProfit > 0) ? (grossProfit / revenueStat * 100) : 0;

        // Calculate ROE approximation: if we have Equity and EPS data, approximate
        const equity = equityRes.rows.length > 0 ? parseFloat(equityRes.rows[0].value) : 0;
        // Use annualized EPS * 1000 (shares) vs equity as proxy
        const latestEPS = epsRes.rows.length > 0 ? parseFloat(epsRes.rows[0].value) : 0;
        // ROE proxy: if PE and PB are available, ROE ≈ PB/PE * 100
        const latestROE = (pe > 0 && pb > 0) ? (pb / pe * 100) : 0;

        let profitScore = 0;
        if (latestROE > 20) profitScore += 50; else if (latestROE > 10) profitScore += 35; else if (latestROE > 5) profitScore += 20; else profitScore += 5;
        if (latestGrossMargin > 40) profitScore += 50; else if (latestGrossMargin > 25) profitScore += 35; else if (latestGrossMargin > 15) profitScore += 20; else profitScore += 5;

        // --- 2. Growth Score (成長能力) ---
        const revRows = revenueRes.rows;
        let revenueGrowth = 0;
        if (revRows.length >= 13) {
            const curr = parseFloat(revRows[0].revenue);
            const prev = parseFloat(revRows[12].revenue);
            if (prev > 0) revenueGrowth = ((curr - prev) / prev) * 100;
        }
        const epsRows = epsRes.rows;
        let epsGrowth = 0;
        if (epsRows.length >= 5) {
            const currEps = parseFloat(epsRows[0].value);
            const prevEps = parseFloat(epsRows[4].value);
            if (prevEps > 0) epsGrowth = ((currEps - prevEps) / prevEps) * 100;
        }
        let growthScore = 0;
        if (revenueGrowth > 20) growthScore += 50; else if (revenueGrowth > 10) growthScore += 35; else if (revenueGrowth > 0) growthScore += 20; else growthScore += 5;
        if (epsGrowth > 20) growthScore += 50; else if (epsGrowth > 10) growthScore += 35; else if (epsGrowth > 0) growthScore += 20; else growthScore += 5;

        // --- 3. Safety Score (安全性) ---
        // Use PB as a proxy for debt level (lower = safer in general for value stocks)
        let safetyScore = 50;
        if (pb > 0 && pb < 1) safetyScore = 90; else if (pb < 1.5) safetyScore = 70; else if (pb < 3) safetyScore = 50; else safetyScore = 30;

        // --- 4. Value Score (價值衡量) ---
        let valueScore = 50;
        if (pe > 0 && pe < 10) valueScore = 90; else if (pe < 15) valueScore = 75; else if (pe < 20) valueScore = 55; else if (pe < 30) valueScore = 35; else valueScore = 15;

        // --- 5. Dividend Score (配息能力) ---
        const divRows = dividendRes.rows;
        const avgCashDividend = divRows.length > 0 ? divRows.reduce((s, d) => s + parseFloat(d.cash_dividend || 0), 0) / divRows.length : 0;
        let dividendScore = 0;
        if (dy > 6) dividendScore += 50; else if (dy > 4) dividendScore += 35; else if (dy > 2) dividendScore += 20; else dividendScore += 5;
        if (avgCashDividend > 3) dividendScore += 50; else if (avgCashDividend > 1.5) dividendScore += 35; else if (avgCashDividend > 0.5) dividendScore += 20; else dividendScore += 5;

        // --- 6. Chip Score (籌碼面) ---
        const instRows = instRes.rows;
        const totalBuy = instRows.reduce((s, r) => s + parseFloat(r.total_net || 0), 0);
        const foreignBuy = instRows.reduce((s, r) => s + parseFloat(r.foreign_net || 0), 0);
        let chipScore = 50;
        if (totalBuy > 10000) chipScore = 90; else if (totalBuy > 5000) chipScore = 75; else if (totalBuy > 0) chipScore = 55; else if (totalBuy > -5000) chipScore = 35; else chipScore = 15;

        // Overall
        const overall = Math.round((profitScore + growthScore + safetyScore + valueScore + dividendScore + chipScore) / 6);

        // Grade
        let grade = '普通';
        let gradeColor = 'neutral';
        if (overall >= 75) { grade = '優秀'; gradeColor = 'green'; }
        else if (overall >= 60) { grade = '良好'; gradeColor = 'blue'; }
        else if (overall >= 45) { grade = '普通'; gradeColor = 'yellow'; }
        else { grade = '待改善'; gradeColor = 'red'; }

        res.json({
            success: true,
            symbol,
            overall,
            grade,
            gradeColor,
            dimensions: [
                { name: '獲利能力', score: profitScore, detail: `ROE: ${latestROE.toFixed(1)}%, 毛利率: ${latestGrossMargin.toFixed(1)}%` },
                { name: '成長能力', score: growthScore, detail: `營收YoY: ${revenueGrowth.toFixed(1)}%, EPS成長: ${epsGrowth.toFixed(1)}%` },
                { name: '安全性', score: safetyScore, detail: `PB: ${pb.toFixed(2)}` },
                { name: '價值衡量', score: valueScore, detail: `PE: ${pe.toFixed(2)}` },
                { name: '配息能力', score: dividendScore, detail: `殖利率: ${dy.toFixed(2)}%, 平均現金股利: ${avgCashDividend.toFixed(2)}元` },
                { name: '籌碼面', score: chipScore, detail: `近10日法人買賣超: ${(totalBuy / 1000).toFixed(0)}張` }
            ],
            metrics: {
                pe, pb, dy, latestROE, latestGrossMargin, revenueGrowth, epsGrowth, avgCashDividend, totalBuy: totalBuy / 1000, closePrice
            }
        });
    } catch (err) {
        console.error('Health check error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/stock/:symbol/valuation-history - 個股估價歷史 (本益比/淨值比河流圖)
router.get('/stock/:symbol/valuation-history', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { years = 5 } = req.query;

        // Get PE/PB history from fundamentals table (which has daily PE/PB data)
        const perRes = await query(`
            SELECT trade_date as date, pe_ratio, pb_ratio, dividend_yield
            FROM fundamentals
            WHERE symbol = $1 AND pe_ratio IS NOT NULL AND pe_ratio > 0 AND pe_ratio < 200
            ORDER BY trade_date DESC
            LIMIT $2
        `, [symbol, parseInt(years) * 250]);

        // Get dividend history for yield-based valuation
        const divRes = await query(`
            SELECT year, cash_dividend FROM dividend_policy WHERE symbol = $1 ORDER BY year DESC LIMIT 10
        `, [symbol]);

        // Get current price
        const priceRes = await query('SELECT close_price FROM daily_prices WHERE symbol = $1 ORDER BY trade_date DESC LIMIT 1', [symbol]);
        const currentPrice = parseFloat(priceRes.rows[0]?.close_price) || 0;

        const history = perRes.rows.reverse().map(r => ({
            date: r.date,
            pe: parseFloat(r.pe_ratio),
            pb: parseFloat(r.pb_ratio),
            dy: parseFloat(r.dividend_yield) || 0
        }));

        // Calculate PE statistics
        const peValues = history.map(h => h.pe).filter(v => v > 0 && v < 200);
        const pbValues = history.map(h => h.pb).filter(v => v > 0);

        const peAvg = peValues.length > 0 ? peValues.reduce((a, b) => a + b, 0) / peValues.length : 0;
        const pbAvg = pbValues.length > 0 ? pbValues.reduce((a, b) => a + b, 0) / pbValues.length : 0;

        const peStd = peValues.length > 1 ? Math.sqrt(peValues.reduce((s, v) => s + (v - peAvg) ** 2, 0) / (peValues.length - 1)) : 0;
        const pbStd = pbValues.length > 1 ? Math.sqrt(pbValues.reduce((s, v) => s + (v - pbAvg) ** 2, 0) / (pbValues.length - 1)) : 0;

        // PE Bands
        const peBands = {
            veryExpensive: peAvg + 2 * peStd,
            expensive: peAvg + peStd,
            fair: peAvg,
            cheap: peAvg - peStd,
            veryCheap: peAvg - 2 * peStd > 0 ? peAvg - 2 * peStd : 1
        };

        // Dividend-based valuation
        const avgCashDiv = divRes.rows.length > 0
            ? divRes.rows.reduce((s, d) => s + parseFloat(d.cash_dividend || 0), 0) / divRes.rows.length
            : 0;
        const yieldValuation = avgCashDiv > 0 ? {
            cheap: (avgCashDiv / 0.06).toFixed(2),   // 6% yield = cheap
            fair: (avgCashDiv / 0.05).toFixed(2),     // 5% yield = fair
            expensive: (avgCashDiv / 0.04).toFixed(2) // 4% yield = expensive
        } : null;

        // Current valuation zone
        const currentPe = peValues.length > 0 ? peValues[peValues.length - 1] : 0;
        let zone = '合理區';
        if (currentPe > peBands.expensive) zone = '偏貴區';
        if (currentPe > peBands.veryExpensive) zone = '昂貴區';
        if (currentPe < peBands.cheap) zone = '偏低區';
        if (currentPe < peBands.veryCheap) zone = '便宜區';

        res.json({
            success: true,
            symbol,
            currentPrice,
            currentPe,
            zone,
            history,
            peBands,
            pbBands: {
                expensive: pbAvg + pbStd,
                fair: pbAvg,
                cheap: pbAvg - pbStd > 0 ? pbAvg - pbStd : 0.1
            },
            yieldValuation,
            stats: {
                peAvg: peAvg.toFixed(2),
                peStd: peStd.toFixed(2),
                pbAvg: pbAvg.toFixed(2),
                pbStd: pbStd.toFixed(2),
                avgCashDiv: avgCashDiv.toFixed(2)
            }
        });
    } catch (err) {
        console.error('Valuation history error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/stocks/compare - 個股 PK (多股比較)
router.get('/stocks/compare', async (req, res) => {
    try {
        const { symbols } = req.query;
        if (!symbols) return res.json({ success: false, message: '請提供股票代碼' });

        const symbolList = symbols.split(',').slice(0, 4); // Max 4 stocks

        const results = await Promise.all(symbolList.map(async (symbol) => {
            const sym = symbol.trim();
            const [stockRes, priceRes, fundRes, ratiosRes, instRes, divRes, revenueRes] = await Promise.all([
                query('SELECT symbol, name, industry, market FROM stocks WHERE symbol = $1', [sym]),
                query('SELECT close_price, change_percent, volume, trade_date FROM daily_prices WHERE symbol = $1 ORDER BY trade_date DESC LIMIT 1', [sym]),
                query('SELECT pe_ratio, pb_ratio, dividend_yield FROM fundamentals WHERE symbol = $1 ORDER BY trade_date DESC LIMIT 1', [sym]),
                query(`SELECT type, value FROM fm_financial_statements WHERE stock_id = $1 AND type IN ('ROE', 'ROA', 'GrossProfitMargin', 'OperatingIncomeMargin', 'NetIncomeMargin') ORDER BY date DESC LIMIT 5`, [sym]),
                query('SELECT foreign_net, trust_net, total_net FROM institutional WHERE symbol = $1 ORDER BY trade_date DESC LIMIT 5', [sym]),
                query('SELECT year, cash_dividend, stock_dividend FROM dividend_policy WHERE symbol = $1 ORDER BY year DESC LIMIT 5', [sym]),
                query('SELECT revenue, revenue_year, revenue_month FROM monthly_revenue WHERE symbol = $1 ORDER BY revenue_year DESC, revenue_month DESC LIMIT 13', [sym])
            ]);

            const stock = stockRes.rows[0] || {};
            const price = priceRes.rows[0] || {};
            const fund = fundRes.rows[0] || {};

            // Extract latest ratios
            const getLatestRatio = (type) => {
                const row = ratiosRes.rows.find(r => r.type === type);
                return row ? parseFloat(row.value) : null;
            };

            // Revenue growth
            let revenueGrowth = null;
            if (revenueRes.rows.length >= 13) {
                const curr = parseFloat(revenueRes.rows[0].revenue);
                const prev = parseFloat(revenueRes.rows[12].revenue);
                if (prev > 0) revenueGrowth = ((curr - prev) / prev * 100);
            }

            // Inst flow
            const totalInstBuy = instRes.rows.reduce((s, r) => s + parseFloat(r.total_net || 0), 0) / 1000;

            // Avg cash dividend
            const avgCashDiv = divRes.rows.length > 0
                ? divRes.rows.reduce((s, d) => s + parseFloat(d.cash_dividend || 0), 0) / divRes.rows.length
                : 0;

            return {
                symbol: sym,
                name: stock.name || sym,
                industry: stock.industry,
                market: stock.market,
                closePrice: parseFloat(price.close_price) || 0,
                changePercent: parseFloat(price.change_percent) || 0,
                volume: parseInt(price.volume) || 0,
                pe: parseFloat(fund.pe_ratio) || null,
                pb: parseFloat(fund.pb_ratio) || null,
                dividendYield: parseFloat(fund.dividend_yield) || null,
                roe: getLatestRatio('ROE'),
                roa: getLatestRatio('ROA'),
                grossMargin: getLatestRatio('GrossProfitMargin'),
                operatingMargin: getLatestRatio('OperatingIncomeMargin'),
                netMargin: getLatestRatio('NetIncomeMargin'),
                revenueGrowth,
                instNetBuy5d: totalInstBuy,
                avgCashDividend: avgCashDiv
            };
        }));

        res.json({ success: true, data: results });
    } catch (err) {
        console.error('Stock compare error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/health-check-ranking - 全股健診排行
router.get('/health-check-ranking', async (req, res) => {
    try {
        const {
            sort = 'overall_score',
            order = 'DESC',
            industry,
            market,
            stock_types, // NEW: added stock types
            grade,
            minScore = 0,
            maxScore = 100,
            page = 1,
            limit = 50,
            search
        } = req.query;

        // Allowed sort columns
        const allowedSorts = ['overall_score', 'profit_score', 'growth_score', 'safety_score', 'value_score', 'dividend_score', 'chip_score', 'close_price', 'change_percent', 'pe', 'pb', 'dividend_yield', 'roe', 'gross_margin', 'revenue_growth', 'symbol'];
        const sortCol = allowedSorts.includes(sort) ? sort : 'overall_score';
        const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        // Get latest calc_date
        const dateRes = await query('SELECT MAX(calc_date) as latest FROM stock_health_scores');
        const latestDate = dateRes.rows[0]?.latest;
        if (!latestDate) return res.json({ success: true, data: [], total: 0, message: '尚無健診資料，請先執行健診計算' });

        // Build filters
        let conditions = ['calc_date = $1', 'overall_score >= $2', 'overall_score <= $3'];
        let params = [latestDate, parseInt(minScore), parseInt(maxScore)];
        let paramIdx = 4;

        if (industry) {
            conditions.push(`industry = $${paramIdx}`);
            params.push(industry);
            paramIdx++;
        }
        if (market) {
            conditions.push(`market = $${paramIdx}`);
            params.push(market);
            paramIdx++;
        }

        // Apply Stock Types Filter (same logic as main screener)
        if (stock_types) {
            const types = stock_types.split(',');
            const typeConditions = [];
            // 個股: 4碼純數字
            if (types.includes('stock')) typeConditions.push("(symbol ~ '^[0-9]{4}$')");
            // ETF: '00' 開頭的 6 碼數字 (移除結尾 L/R 限制，廣泛匹配)
            if (types.includes('etf')) typeConditions.push("(symbol ~ '^00[0-9]{4}')");
            // 權證: 6碼且不是 00 開頭
            if (types.includes('warrant')) typeConditions.push("(symbol ~ '^[0-9]{6}$' AND symbol !~ '^00' AND symbol !~ '^02')");

            if (typeConditions.length > 0) {
                conditions.push(`(${typeConditions.join(' OR ')})`);
            }
        }

        if (grade) {
            conditions.push(`grade = $${paramIdx}`);
            params.push(grade);
            paramIdx++;
        }
        if (search) {
            conditions.push(`(symbol ILIKE $${paramIdx} OR name ILIKE $${paramIdx})`);
            params.push(`%${search}%`);
            paramIdx++;
        }

        const whereClause = conditions.join(' AND ');

        // Count
        const countRes = await query(`SELECT COUNT(*) as cnt FROM stock_health_scores WHERE ${whereClause}`, params);
        const total = parseInt(countRes.rows[0].cnt);

        // Fetch
        const offset = (parseInt(page) - 1) * parseInt(limit);
        params.push(parseInt(limit));
        params.push(offset);

        const dataRes = await query(`
            SELECT symbol, name, industry, market, close_price, change_percent,
                   overall_score, grade, grade_color,
                   profit_score, growth_score, safety_score, value_score, dividend_score, chip_score,
                   pe, pb, dividend_yield, roe, gross_margin,
                   revenue_growth, eps_growth, avg_cash_dividend, inst_net_buy, calc_date
            FROM stock_health_scores
            WHERE ${whereClause}
            ORDER BY ${sortCol} ${sortOrder} NULLS LAST
            LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
        `, params);

        // Get distinct industries for filter dropdown
        const indRes = await query(`SELECT DISTINCT industry FROM stock_health_scores WHERE calc_date = $1 AND industry IS NOT NULL ORDER BY industry`, [latestDate]);

        res.json({
            success: true,
            data: dataRes.rows,
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            calcDate: latestDate,
            industries: indRes.rows.map(r => r.industry)
        });
    } catch (err) {
        console.error('Health check ranking error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
