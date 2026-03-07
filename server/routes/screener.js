const express = require('express');
const router = express.Router();
const { query } = require('../db');

// 日期格式化助手 (解決時區偏移問題)
const formatLocalDate = (date) => {
    if (!date) return null;
    if (!(date instanceof Date)) {
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
            stock_types = 'stock'
        } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

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

        if (date) {
            const requestedDate = new Date(date);
            if (!isNaN(requestedDate)) latestDateRaw = requestedDate;
        }

        let actualDate = latestDateRaw;
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

        const types = (stock_types || 'stock').split(',');
        let typeConditions = [];
        if (types.includes('stock')) typeConditions.push("(s.symbol ~ '^[0-9]{4}$' AND s.symbol !~ '^00')");
        if (types.includes('etf')) typeConditions.push("(s.symbol ~ '^00' OR s.name ILIKE '%ETF%')");
        if (types.includes('warrant')) typeConditions.push("(s.symbol ~ '^[0-9]{6}$' AND s.symbol !~ '^00' AND s.symbol !~ '^02')");

        if (typeConditions.length > 0) {
            whereClause += ` AND (${typeConditions.join(' OR ')})`;
        }

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

        if (strategy) {
            switch (strategy) {
                case 'bullish_ma':
                    whereClause += ` AND i.ma_5 > i.ma_10 AND i.ma_10 > i.ma_20 AND i.ma_20 > i.ma_60 AND p.close_price > i.ma_5`;
                    break;
                case 'breakout':
                    whereClause += ` AND p.close_price > i.ma_20 AND p.open_price < i.ma_20 AND p.close_price > p.open_price`;
                    break;
                case 'high_yield':
                    whereClause += ` AND f.dividend_yield > 5`;
                    break;
                case 'value_invest':
                    whereClause += ` AND f.pe_ratio > 0 AND f.pe_ratio < 15 AND f.pb_ratio > 0 AND f.pb_ratio < 1`;
                    break;
                case 'inst_buy':
                    whereClause += ` AND inst.foreign_net > 0 AND inst.trust_net > 0`;
                    break;
                case 'kenneth_fisher':
                    whereClause += ` AND f.pe_ratio > 0 AND f.pe_ratio < 15 AND p.change_percent > 0`;
                    break;
                case 'michael_price':
                    whereClause += ` AND f.pb_ratio > 0 AND f.pb_ratio < 1.2 AND f.dividend_yield > 3`;
                    break;
                case 'warren_buffett':
                    whereClause += ` AND f.pe_ratio > 0 AND f.pe_ratio < 20 AND f.pb_ratio < 1.5 AND f.dividend_yield > 2`;
                    break;
                case 'benjamin_graham':
                    whereClause += ` AND f.pe_ratio > 0 AND f.pb_ratio > 0 AND (f.pe_ratio * f.pb_ratio) < 22.5`;
                    break;
                case 'peter_lynch':
                    whereClause += ` AND f.pe_ratio > 0 AND f.pe_ratio < 12 AND p.close_price > i.ma_20`;
                    break;
                case 'michael_murphy':
                    whereClause += ` AND i.ma_5 > i.ma_10 AND i.ma_10 > i.ma_20`;
                    break;
                case 'safe_dividend':
                    whereClause += ` AND f.dividend_yield > 5`;
                    break;
                case 'financial_giant':
                    whereClause += ` AND inst.total_net > 1000 AND p.change_percent > 0`;
                    break;
            }
        }

        if (patterns) {
            const patternList = patterns.split(',').filter(Boolean);
            if (patternList.length > 0) {
                whereClause += ` AND (i.patterns ?| $${paramCount})`;
                params.push(patternList);
                paramCount++;
            }
        }

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

        const countResult = await query(`SELECT COUNT(*) ${baseQuery}`, params);
        const total = parseInt(countResult.rows[0].count);

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

        const types = (stock_types || 'stock').split(',');
        let typeConditions = [];
        if (types.includes('stock')) typeConditions.push("(s.symbol ~ '^[0-9]{4}$' AND s.symbol !~ '^00')");
        if (types.includes('etf')) typeConditions.push("(s.symbol ~ '^00' OR s.name ILIKE '%ETF%')");
        if (types.includes('warrant')) typeConditions.push("(s.symbol ~ '^[0-9]{6}$' AND s.symbol !~ '^00' AND s.symbol !~ '^02')");

        const typeFilter = typeConditions.length > 0 ? `AND (${typeConditions.join(' OR ')})` : '';

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

// GET /api/stock/:symbol/news - 個股新聞
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
        const fieldMap = { 'foreign': 'foreign_net', 'investment': 'trust_net', 'dealer': 'dealer_net' };
        const field = fieldMap[type] || 'foreign_net';
        const rangeMap = { '3d': 3, '5d': 5, '10d': 10 };
        const days = rangeMap[range] || 3;
        const datesRes = await query(`
            SELECT trade_date 
            FROM institutional 
            GROUP BY trade_date
            HAVING count(*) > 5000
            ORDER BY trade_date DESC 
            LIMIT $1`, [days]);
        if (datesRes.rows.length === 0) return res.json({ success: true, data: [] });
        const targetDates = datesRes.rows.map(r => r.trade_date);
        const sql = `
SELECT i.symbol, s.name, s.industry, s.market, SUM(i.${field}::numeric / 1000.0) as net_buy
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

// GET /api/market-stats - 市場統計
router.get('/market-stats', async (req, res) => {
    try {
        const dateRes = await query(`SELECT trade_date FROM daily_prices GROUP BY trade_date HAVING count(*) > 500 ORDER BY trade_date DESC LIMIT 1`);
        const latestDate = dateRes.rows[0]?.trade_date;
        if (!latestDate) return res.json({});
        const sql = `
        SELECT COUNT(*) filter(where change_percent > 0) as up_count, COUNT(*) filter(where change_percent < 0) as down_count, TO_CHAR($1::date, 'YYYY-MM-DD') as latestDate
        FROM daily_prices WHERE trade_date = $1
        `;
        const result = await query(sql, [latestDate]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/stock/:symbol/institutional
router.get('/stock/:symbol/institutional', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { limit = 60 } = req.query;
        const sql = `
SELECT TO_CHAR(trade_date, 'YYYY-MM-DD') as date, (total_net / 1000.0) as total_net, (foreign_net / 1000.0) as foreign_net, (trust_net / 1000.0) as trust_net, (dealer_net / 1000.0) as dealer_net
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
SELECT s.symbol, s.name, s.industry, s.market, p.close_price, p.change_percent, f.pe_ratio, f.pb_ratio, f.dividend_yield, inst.foreign_net / 1000.0 as foreign_net, inst.trust_net / 1000.0 as trust_net, inst.dealer_net / 1000.0 as dealer_net
            FROM stocks s
            LEFT JOIN LATERAL(SELECT close_price, change_percent FROM daily_prices dp WHERE dp.symbol = s.symbol ORDER BY trade_date DESC LIMIT 1) p ON true
            LEFT JOIN LATERAL(SELECT pe_ratio, pb_ratio, dividend_yield FROM fundamentals WHERE symbol = s.symbol ORDER BY trade_date DESC LIMIT 1) f ON true
            LEFT JOIN LATERAL(SELECT foreign_net, trust_net, dealer_net FROM institutional WHERE symbol = s.symbol ORDER BY trade_date DESC LIMIT 1) inst ON true
            WHERE s.symbol LIKE $1 OR s.name LIKE $1
            ORDER BY CASE WHEN s.symbol = $2 THEN 0 WHEN s.symbol LIKE $3 THEN 1 ELSE 2 END, s.symbol LIMIT $4
        `;
        const result = await query(sql, [`%${q}%`, q, `${q}%`, parseInt(limit)]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/stock/:symbol/health-check - 個股健診
router.get('/stock/:symbol/health-check', async (req, res) => {
    try {
        const { symbol } = req.params;
        const result = await query('SELECT * FROM stock_health_scores WHERE symbol = $1 ORDER BY calc_date DESC LIMIT 1', [symbol]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, error: '找不到該個股健診資料' });

        const data = result.rows[0];
        res.json({
            success: true,
            overall: data.overall_score,
            grade: data.grade,
            gradeColor: data.grade_color,
            dimensions: [
                { name: '獲利能力', score: data.profit_score || 0, detail: '基於 ROE 與毛利率表現' },
                { name: '成長能力', score: data.growth_score || 0, detail: '基於營收與 EPS 成長率' },
                { name: '安全性', score: data.safety_score || 0, detail: '基於負債比與流動比率' },
                { name: '價值衡量', score: data.value_score || 0, detail: '基於 PE/PB 估值位階' },
                { name: '配息能力', score: data.dividend_score || 0, detail: '基於現金殖利率與配息穩定性' },
                { name: '籌碼面', score: data.chip_score || 0, detail: '基於法人近期買賣超動向' }
            ],
            metrics: {
                pe: data.pe,
                dy: data.dividend_yield,
                latestROE: data.roe,
                latestGrossMargin: data.gross_margin,
                totalBuy: data.inst_net_buy
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/compare - 多股比較
router.get('/compare', async (req, res) => {
    try {
        const { symbols } = req.query;
        if (!symbols) return res.json({ success: true, data: [] });
        const symbolList = symbols.split(',');
        const results = await Promise.all(symbolList.map(async sym => {
            const stockRes = await query('SELECT * FROM stocks WHERE symbol = $1', [sym]);
            const priceRes = await query('SELECT * FROM daily_prices WHERE symbol = $1 ORDER BY trade_date DESC LIMIT 1', [sym]);
            const fundRes = await query('SELECT * FROM fundamentals WHERE symbol = $1 ORDER BY trade_date DESC LIMIT 1', [sym]);
            return { symbol: sym, name: stockRes.rows[0]?.name, price: priceRes.rows[0], fundamental: fundRes.rows[0] };
        }));
        res.json({ success: true, data: results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/health-check-ranking - 全股健診排行
router.get('/health-check-ranking', async (req, res) => {
    try {
        const { sort = 'overall_score', order = 'DESC', industry, market, stock_types, grade, minScore = 0, maxScore = 100, page = 1, limit = 50, search } = req.query;
        const dateRes = await query('SELECT MAX(calc_date) as latest FROM stock_health_scores');
        const latestDate = dateRes.rows[0]?.latest;
        if (!latestDate) return res.json({ success: true, data: [], total: 0 });
        let conditions = ['calc_date = $1', 'overall_score >= $2', 'overall_score <= $3'];
        let params = [latestDate, parseInt(minScore), parseInt(maxScore)];
        let paramIdx = 4;
        if (industry) { conditions.push(`industry = $${paramIdx}`); params.push(industry); paramIdx++; }
        if (market) { conditions.push(`market = $${paramIdx}`); params.push(market); paramIdx++; }
        if (stock_types) {
            const types = stock_types.split(',');
            const typeConditions = [];
            if (types.includes('stock')) typeConditions.push("(symbol ~ '^[0-9]{4}$')");
            if (types.includes('etf')) typeConditions.push("(symbol ~ '^00[0-9]{4}')");
            if (types.includes('warrant')) typeConditions.push("(symbol ~ '^[0-9]{6}$' AND symbol !~ '^00' AND symbol !~ '^02')");
            if (typeConditions.length > 0) conditions.push(`(${typeConditions.join(' OR ')})`);
        }
        if (grade) { conditions.push(`grade = $${paramIdx}`); params.push(grade); paramIdx++; }
        if (search) { conditions.push(`(symbol ILIKE $${paramIdx} OR name ILIKE $${paramIdx})`); params.push(`%${search}%`); paramIdx++; }
        const whereClause = conditions.join(' AND ');
        const countRes = await query(`SELECT COUNT(*) as cnt FROM stock_health_scores WHERE ${whereClause}`, params);
        const total = parseInt(countRes.rows[0].cnt);
        const offset = (parseInt(page) - 1) * parseInt(limit);
        params.push(parseInt(limit), offset);
        const dataRes = await query(`SELECT * FROM stock_health_scores WHERE ${whereClause} ORDER BY ${sort} ${order} LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`, params);
        const indRes = await query(`SELECT DISTINCT industry FROM stock_health_scores WHERE calc_date = $1`, [latestDate]);
        res.json({ success: true, data: dataRes.rows, total, industries: indRes.rows.map(r => r.industry) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/stock/:symbol/health-history - 獲取歷史健診分數
router.get('/stock/:symbol/health-history', async (req, res) => {
    try {
        const { symbol } = req.params;
        const sql = `SELECT TO_CHAR(calc_date, 'YYYY-MM-DD') as date, overall_score as score FROM stock_health_scores WHERE symbol = $1 ORDER BY calc_date ASC LIMIT 30`;
        const result = await query(sql, [symbol]);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
