const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/watchlists
// 獲取所有自選股清單及其中的股票
router.get('/', async (req, res) => {
    try {
        const listsRes = await query('SELECT * FROM watchlists ORDER BY created_at ASC');
        const watchlists = listsRes.rows;

        // 取得每個清單的股票，包含基本資料與最新報價
        for (let wl of watchlists) {
            const itemsRes = await query(`
                SELECT 
                    wi.symbol, wi.added_at,
                    s.name, s.market, s.industry,
                    dp.close_price, dp.change_amount, dp.change_percent, dp.volume
                FROM watchlist_items wi
                JOIN stocks s ON wi.symbol = s.symbol
                LEFT JOIN LATERAL (
                    SELECT close_price, change_amount, change_percent, volume
                    FROM daily_prices
                    WHERE symbol = wi.symbol
                    ORDER BY trade_date DESC
                    LIMIT 1
                ) dp ON true
                WHERE wi.watchlist_id = $1
                ORDER BY wi.added_at DESC
            `, [wl.id]);
            wl.items = itemsRes.rows;
        }

        res.json({ success: true, data: watchlists });
    } catch (err) {
        console.error('取得自選股清單失敗:', err);
        res.status(500).json({ success: false, error: '伺服器錯誤' });
    }
});

// POST /api/watchlists/:id/symbols
// 新增股票到自選股清單
router.post('/:id/symbols', async (req, res) => {
    const watchlistId = req.params.id;
    const { symbol } = req.body;

    if (!symbol) {
        return res.status(400).json({ success: false, error: '缺少股票代號 (symbol)' });
    }

    try {
        await query(
            'INSERT INTO watchlist_items (watchlist_id, symbol) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [watchlistId, symbol]
        );
        res.json({ success: true, message: '已加入自選' });
    } catch (err) {
        // 如果 symbol 不存在 stocks 表，會有 foreign key constraint violation
        if (err.code === '23503') {
            return res.status(400).json({ success: false, error: '無效的股票代號' });
        }
        console.error('新增自選股失敗:', err);
        res.status(500).json({ success: false, error: '伺服器錯誤' });
    }
});

// DELETE /api/watchlists/:id/symbols/:symbol
// 從自選股清單移除股票
router.delete('/:id/symbols/:symbol', async (req, res) => {
    const watchlistId = req.params.id;
    const symbol = req.params.symbol;

    try {
        await query(
            'DELETE FROM watchlist_items WHERE watchlist_id = $1 AND symbol = $2',
            [watchlistId, symbol]
        );
        res.json({ success: true, message: '已移除自選' });
    } catch (err) {
        console.error('移除自選股失敗:', err);
        res.status(500).json({ success: false, error: '伺服器錯誤' });
    }
});

// GET /api/watchlists/:id/status/:symbol
// 檢查某檔股票是否在清單中
router.get('/:id/status/:symbol', async (req, res) => {
    const watchlistId = req.params.id;
    const symbol = req.params.symbol;

    try {
        const result = await query(
            'SELECT 1 FROM watchlist_items WHERE watchlist_id = $1 AND symbol = $2',
            [watchlistId, symbol]
        );
        res.json({ success: true, is_watched: result.rowCount > 0 });
    } catch (err) {
        res.status(500).json({ success: false, error: '伺服器錯誤' });
    }
});

module.exports = router;
