const express = require('express');
const router = express.Router();
const { query } = require('../db');

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
            strategy
        } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // 1. 先獲取資料庫最新日期 (全局最新)
        const latestInfoResult = await query('SELECT MAX(trade_date) as max_date FROM daily_prices');
        let latestDateRaw = latestInfoResult.rows[0].max_date;

        if (!latestDateRaw) {
            return res.json({ success: true, data: [], total: 0, page: parseInt(page), totalPages: 0, latestDate: null });
        }

        // 如果使用者有指定日期，則以指定日期為基準
        if (date) {
            const requestedDate = new Date(date);
            if (!isNaN(requestedDate)) {
                latestDateRaw = requestedDate;
            }
        }

        // 2. 找出小於等於指定日期的「實際」最新交易日，這才是篩選基準
        const actualDateResult = await query(
            'SELECT MAX(trade_date) as actual_date FROM daily_prices WHERE trade_date <= $1',
            [latestDateRaw]
        );
        const actualDate = actualDateResult.rows[0].actual_date || latestDateRaw;

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
        const d = new Date(actualDate);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const displayDateStr = `${year}-${month}-${day}`;

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
        const { market = 'all' } = req.query;

        // 1. 取得最新交易日
        const dateRes = await query('SELECT MAX(trade_date) FROM daily_prices');
        const latestDate = dateRes.rows[0].max;
        if (!latestDate) {
            return res.json({ success: false, message: '無資料' });
        }

        let whereClause = "WHERE p.trade_date = $1";
        const params = [latestDate];

        if (market !== 'all') {
            whereClause += " AND s.market = $2";
            params.push(market);
        }

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
            ${whereClause}
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
            ${whereClause} AND s.industry IS NOT NULL AND s.industry != ''
            GROUP BY s.industry
            ORDER BY avg_change DESC
            LIMIT 20
            `;
        const industryResult = await query(industrySql, params);

        // 4. 即時熱門股 (Top Volume)
        const hotStocksSql = `
        SELECT
        s.symbol, s.name, p.close_price, p.change_percent, p.volume
            FROM daily_prices p
            JOIN stocks s ON p.symbol = s.symbol
            ${whereClause}
            ORDER BY p.volume DESC
            LIMIT 10
            `;
        const hotResult = await query(hotStocksSql, params);

        res.json({
            success: true,
            latestDate: latestDate,
            distribution: distResult.rows[0],
            industries: industryResult.rows,
            hotStocks: hotResult.rows
        });
    } catch (err) {
        console.error('Market summary error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/stats
router.get('/stats', async (req, res) => {
    try {
        const sql = `
            WITH latest AS(
                SELECT MAX(trade_date) as m_date FROM daily_prices
            )
        SELECT
        COUNT(*) filter(where change_percent > 0) as up_count,
            COUNT(*) filter(where change_percent < 0) as down_count,
                COUNT(*) filter(where change_percent = 0) as flat_count,
                    AVG(change_percent) as avg_change,
                    TO_CHAR((SELECT m_date FROM latest), 'YYYY-MM-DD') as "latestDate"
            FROM daily_prices
            WHERE trade_date = (SELECT m_date FROM latest)
`;
        const result = await query(sql);
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

        // 取得最近的 N 個交易日
        const datesRes = await query(`
            SELECT DISTINCT trade_date 
            FROM institutional 
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
            WHERE i.trade_date = ANY($1)
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

// GET /api/market-summary - 市場統計 (別名，用於相容)
router.get('/market-summary', async (req, res) => {
    try {
        const sql = `
            WITH latest AS(
        SELECT MAX(trade_date) as m_date FROM daily_prices
    )
SELECT
COUNT(*) filter(where change_percent > 0) as up_count,
    COUNT(*) filter(where change_percent < 0) as down_count,
        TO_CHAR((SELECT m_date FROM latest), 'YYYY-MM-DD') as latestDate
            FROM daily_prices
            WHERE trade_date = (SELECT m_date FROM latest)
`;
        const result = await query(sql);
        res.json({ success: true, ...result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/market-stats - 市場統計 (用於頁首)
router.get('/market-stats', async (req, res) => {
    try {
        const sql = `
            WITH latest AS(
    SELECT MAX(trade_date) as m_date FROM daily_prices
)
SELECT
COUNT(*) filter(where change_percent > 0) as up_count,
    COUNT(*) filter(where change_percent < 0) as down_count,
        TO_CHAR((SELECT m_date FROM latest), 'YYYY-MM-DD') as latestDate
            FROM daily_prices
            WHERE trade_date = (SELECT m_date FROM latest)
`;
        const result = await query(sql);
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
        const result = await query(sql, [`% ${q}% `, q, `${q}% `, parseInt(limit)]);
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
        const dateRes = await query('SELECT MAX(date) FROM fm_broker_trading WHERE stock_id = $1', [symbol]);
        const latestDate = dateRes.rows[0].max;

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
            date: latestDate,
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

        const z = parseFloat(info.z);
        const y = parseFloat(info.y);
        const change = z && y ? (z - y) : 0;
        const changePercent = z && y ? (change / y) * 100 : 0;

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
            last_price: info.z === '-' ? null : z,
            change: change,
            change_percent: changePercent,
            volume: parseInt(info.v),
            trade_volume: parseInt(info.tv),
            open: parseFloat(info.o),
            high: parseFloat(info.h),
            low: parseFloat(info.l),
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

module.exports = router;
