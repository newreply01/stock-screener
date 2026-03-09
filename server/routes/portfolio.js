const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

// GET /api/portfolio - 獲取使用者持股與損益
router.get('/', requireAuth, async (req, res) => {
    try {
        const sql = `
            SELECT 
                h.symbol, 
                s.name, 
                h.quantity, 
                h.avg_cost,
                p.close_price as current_price,
                p.change_percent as daily_change,
                (p.close_price - h.avg_cost) * h.quantity as unrealized_pnl,
                CASE WHEN h.avg_cost > 0 
                     THEN ((p.close_price - h.avg_cost) / h.avg_cost) * 100 
                     ELSE 0 
                END as pnl_percent
            FROM user_holdings h
            JOIN stocks s ON h.symbol = s.symbol
            LEFT JOIN LATERAL (
                SELECT close_price, change_percent
                FROM daily_prices dp
                WHERE dp.symbol = h.symbol
                ORDER BY trade_date DESC
                LIMIT 1
            ) p ON true
            WHERE h.user_id = $1
            ORDER BY unrealized_pnl DESC
        `;
        const result = await query(sql, [req.user.id]);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Fetch portfolio error:', err);
        res.status(500).json({ success: false, error: '伺服器錯誤' });
    }
});

// POST /api/portfolio - 新增或更新持股
router.post('/', requireAuth, async (req, res) => {
    const { symbol, quantity, avg_cost } = req.body;
    if (!symbol || quantity === undefined || avg_cost === undefined) {
        return res.status(400).json({ success: false, error: '缺少必要欄位' });
    }

    try {
        const result = await query(
            'INSERT INTO user_holdings (user_id, symbol, quantity, avg_cost) VALUES ($1, $2, $3, $4) ' +
            'ON CONFLICT ON CONSTRAINT user_holdings_user_id_symbol_key DO UPDATE SET ' +
            'quantity = $3, avg_cost = $4, last_updated = NOW() RETURNING *',
            [req.user.id, symbol, quantity, avg_cost]
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Update portfolio error:', err);
        res.status(500).json({ success: false, error: '伺服器錯誤' });
    }
});

// DELETE /api/portfolio/:symbol - 刪除持股
router.delete('/:symbol', requireAuth, async (req, res) => {
    try {
        await query('DELETE FROM user_holdings WHERE user_id = $1 AND symbol = $2', [req.user.id, req.params.symbol]);
        res.json({ success: true, message: '已移除持股' });
    } catch (err) {
        console.error('Delete portfolio error:', err);
        res.status(500).json({ success: false, error: '伺服器錯誤' });
    }
});

module.exports = router;
