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
            foreign_net_min, foreign_net_max,
            trust_net_min, trust_net_max,
            dealer_net_min, dealer_net_max,
            total_net_min, total_net_max,
            date,
            market
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
        addRangeFilter('inst.foreign_net', foreign_net_min, foreign_net_max);
        addRangeFilter('inst.trust_net', trust_net_min, trust_net_max);
        addRangeFilter('inst.dealer_net', dealer_net_min, dealer_net_max);
        addRangeFilter('inst.total_net', total_net_min, total_net_max);

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
                WHERE f_sub.symbol = s.symbol AND f_sub.trade_date <= $1
                ORDER BY f_sub.trade_date DESC
                LIMIT 1
            ) f ON true
            LEFT JOIN LATERAL (
                SELECT foreign_net, trust_net, dealer_net, total_net
                FROM institutional inst_sub
                WHERE inst_sub.symbol = s.symbol AND inst_sub.trade_date <= $1
                ORDER BY inst_sub.trade_date DESC
                LIMIT 1
            ) inst ON true
            LEFT JOIN LATERAL (
                SELECT patterns, rsi_14, macd_hist, ma_20
                FROM indicators i_sub
                WHERE i_sub.symbol = s.symbol AND i_sub.trade_date <= $1
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
                p.trade_date as result_date
            ${baseQuery}
            ORDER BY ${sort_by === 'symbol' ? 's.symbol' : sort_by === 'name' ? 's.name' : 'p.' + sort_by} ${sort_dir}
            LIMIT $${paramCount} OFFSET $${paramCount + 1}
        `;
        params.push(parseInt(limit), offset);

        const dataResult = await query(dataSQL, params);

        // 返回前端預期的格式
        const displayDateStr = new Date(actualDate).toISOString().split('T')[0];

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
                COUNT(*) filter (where change_percent >= 9.5) as limit_up,
                COUNT(*) filter (where change_percent >= 5 AND change_percent < 9.5) as up_5,
                COUNT(*) filter (where change_percent >= 2 AND change_percent < 5) as up_2_5,
                COUNT(*) filter (where change_percent > 0 AND change_percent < 2) as up_0_2,
                COUNT(*) filter (where change_percent = 0) as flat,
                COUNT(*) filter (where change_percent > -2 AND change_percent < 0) as down_0_2,
                COUNT(*) filter (where change_percent > -5 AND change_percent <= -2) as down_2_5,
                COUNT(*) filter (where change_percent > -9.5 AND change_percent <= -5) as down_5,
                COUNT(*) filter (where change_percent <= -9.5) as limit_down
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
            WITH latest AS (
                SELECT MAX(trade_date) as m_date FROM daily_prices
            )
            SELECT 
                COUNT(*) filter (where change_percent > 0) as up_count,
                COUNT(*) filter (where change_percent < 0) as down_count,
                COUNT(*) filter (where change_percent = 0) as flat_count,
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
        const { limit = 200 } = req.query;
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
            news_id: `fm-${row.stock_id}-${row.date}-${idx}`,
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
        const f = await query('SELECT * FROM fundamentals WHERE symbol = $1', [symbol]);
        const r = await query('SELECT * FROM monthly_revenue WHERE symbol = $1 ORDER BY date DESC LIMIT 12', [symbol]);
        const e = await query('SELECT * FROM financial_statements WHERE symbol = $1 AND type = $2 ORDER BY date DESC LIMIT 4', [symbol, 'EPS']);
        res.json({ info: f.rows[0], revenue: r.rows, eps: e.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/institutional-rank - 三大法人排行
router.get('/institutional-rank', async (req, res) => {
    try {
        const { type = 'foreign', range = '3d' } = req.query;

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
                SUM(i.${field}) as net_buy
            FROM institutional i
            JOIN stocks s ON i.symbol = s.symbol
            WHERE i.trade_date = ANY($1)
            GROUP BY i.symbol, s.name, s.industry, s.market
            HAVING SUM(i.${field}) > 0
            ORDER BY net_buy DESC
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
        const sql = `
            WITH latest AS (
                SELECT MAX(trade_date) as m_date FROM daily_prices
            )
            SELECT 
                COUNT(*) filter (where change_percent > 0) as up_count,
                COUNT(*) filter (where change_percent < 0) as down_count,
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
            SELECT TO_CHAR(trade_date, 'YYYY-MM-DD') as date, total_net, foreign_net, trust_net, dealer_net
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
            SELECT symbol, name, industry, market
            FROM stocks
            WHERE symbol LIKE $1 OR name LIKE $1
            ORDER BY 
                CASE 
                    WHEN symbol = $2 THEN 0
                    WHEN name = $2 THEN 1
                    WHEN symbol LIKE $3 THEN 2
                    WHEN name LIKE $3 THEN 3
                    ELSE 4
                END,
                symbol ASC
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

module.exports = router;
