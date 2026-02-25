const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/screen - 篩選股票 (支持分頁與篩選)
router.get('/screen', async (req, res) => {
    try {
        const { search = '', industry = '', patterns = '', sort_by = 'volume', sort_dir = 'desc', page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let whereClause = "WHERE p.trade_date = (SELECT MAX(trade_date) FROM daily_prices)";
        const params = [];
        let paramCount = 1;

        if (search) {
            whereClause += ` AND (s.symbol LIKE $${paramCount} OR s.name LIKE $${paramCount})`;
            params.push(`%${search}%`);
            paramCount++;
        }

        if (industry) {
            whereClause += ` AND s.industry = $${paramCount}`;
            params.push(industry);
            paramCount++;
        }

        if (patterns) {
            // patterns comes in as comma-separated: 'bullish_engulfing,morning_star'
            const patternList = patterns.split(',').filter(Boolean);
            if (patternList.length > 0) {
                // To match ANY of the selected patterns, using JSONB containment or intersection
                // i.patterns ?| array['p1', 'p2']
                whereClause += ` AND i.patterns ?| $${paramCount}`;
                params.push(patternList);
                paramCount++;
            }
        }

        // 基本查詢語法
        const baseQuery = `
            FROM stocks s
            JOIN daily_prices p ON s.symbol = p.symbol
            LEFT JOIN (
                SELECT DISTINCT ON (symbol) symbol, pe_ratio, pb_ratio, dividend_yield
                FROM fundamentals
                ORDER BY symbol, trade_date DESC
            ) f ON s.symbol = f.symbol
            LEFT JOIN (
                SELECT DISTINCT ON (symbol) symbol, patterns
                FROM indicators
                ORDER BY symbol, trade_date DESC
            ) i ON s.symbol = i.symbol
            ${whereClause}
        `;

        // 獲取總數
        const countResult = await query(`SELECT COUNT(*) ${baseQuery}`, params);
        const total = parseInt(countResult.rows[0].count);

        // 獲取數據
        const dataSql = `
            SELECT 
                s.symbol, s.name, s.industry, s.market,
                p.close_price, p.change_percent, p.volume,
                f.pe_ratio, f.pb_ratio, f.dividend_yield
            ${baseQuery}
            ORDER BY ${sort_by === 'volume' ? 'p.volume' : sort_by} ${sort_dir === 'asc' ? 'ASC' : 'DESC'}
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;

        const dataResult = await query(dataSql, [...params, parseInt(limit), offset]);

        // 取得資料庫最新日期
        const dateRes = await query('SELECT MAX(trade_date) FROM daily_prices');
        const latestDate = dateRes.rows[0].max ? new Date(dateRes.rows[0].max).toISOString().split('T')[0] : '2026-02-24';

        // 返回前端預期的格式
        res.json({
            data: dataResult.rows,
            total: total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            latestDate: latestDate
        });
    } catch (err) {
        console.error('Screener error:', err);
        res.status(500).json({ error: err.message });
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

module.exports = router;
