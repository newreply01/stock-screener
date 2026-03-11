const express = require('express');
const router = express.Router();
const { pool } = require('../db');

/**
 * @api {get} /api/broker/top-traders/:symbol 取得個股前 15 大買賣分點
 */
router.get('/top-traders/:symbol', async (req, res) => {
    const { symbol } = req.params;
    const { days = 10 } = req.query; // 預設看 10 天

    try {
        // 1. 取得最近 X 天的有交易日期
        const datesRes = await pool.query(`
            SELECT DISTINCT date FROM fm_broker_trading 
            WHERE stock_id = $1 
            ORDER BY date DESC 
            LIMIT $2
        `, [symbol, days]);

        if (datesRes.rows.length === 0) {
            return res.json({ buying: [], selling: [] });
        }

        const latestDates = datesRes.rows.map(r => r.date);

        // 2. 彙總這段期間內各分點的進出總和
        const dataRes = await pool.query(`
            SELECT 
                broker,
                SUM(buy) as total_buy,
                SUM(sell) as total_sell,
                (SUM(buy) - SUM(sell)) as net_buy
            FROM fm_broker_trading
            WHERE stock_id = $1 AND date = ANY($2)
            GROUP BY broker
            HAVING SUM(buy) > 0 OR SUM(sell) > 0
            ORDER BY net_buy DESC
        `, [symbol, latestDates]);

        const buying = dataRes.rows.filter(r => r.net_buy > 0).slice(0, 15);
        const selling = dataRes.rows
            .filter(r => r.net_buy < 0)
            .sort((a, b) => a.net_buy - b.net_buy) // 最賣的在前面
            .slice(0, 15);

        res.json({ buying, selling, dates: latestDates });
    } catch (err) {
        console.error('Error fetching top traders:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @api {get} /api/broker/major-trend/:symbol 取得主力進出趨勢 (Top 15 淨買賣總和)
 */
router.get('/major-trend/:symbol', async (req, res) => {
    const { symbol } = req.params;
    const { days = 30 } = req.query;

    try {
        const trendRes = await pool.query(`
            WITH daily_stats AS (
                SELECT 
                    date,
                    broker,
                    (SUM(buy) - SUM(sell)) as net_buy
                FROM fm_broker_trading
                WHERE stock_id = $1
                GROUP BY date, broker
            ),
            daily_ranks AS (
                SELECT 
                    date,
                    SUM(net_buy) FILTER (WHERE net_buy > 0) as total_buying,
                    SUM(abs(net_buy)) FILTER (WHERE net_buy < 0) as total_selling
                FROM (
                    SELECT 
                        date, 
                        net_buy,
                        ROW_NUMBER() OVER (PARTITION BY date ORDER BY net_buy DESC) as rank_buy,
                        ROW_NUMBER() OVER (PARTITION BY date ORDER BY net_buy ASC) as rank_sell
                    FROM daily_stats
                ) t
                WHERE rank_buy <= 15 OR rank_sell <= 15
                GROUP BY date
            )
            SELECT 
                date,
                (total_buying - total_selling) as major_net_buy
            FROM daily_ranks
            ORDER BY date DESC
            LIMIT $2
        `, [symbol, days]);

        res.json(trendRes.rows.reverse());
    } catch (err) {
        console.error('Error fetching major trend:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
