const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

// GET /api/filters — 取得使用者儲存的篩選器
router.get('/', requireAuth, async (req, res) => {
    try {
        const result = await query(
            'SELECT * FROM saved_filters WHERE user_id = $1 ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('取得篩選器失敗:', err);
        res.status(500).json({ success: false, error: '伺服器錯誤' });
    }
});

// POST /api/filters — 儲存新的篩選器
router.post('/', requireAuth, async (req, res) => {
    const { name, filters } = req.body;
    if (!name || !filters) {
        return res.status(400).json({ success: false, error: '缺少名稱或篩選條件' });
    }

    try {
        const result = await query(
            'INSERT INTO saved_filters (name, filters, user_id) VALUES ($1, $2, $3) RETURNING *',
            [name, filters, req.user.id]
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('儲存篩選器失敗:', err);
        res.status(500).json({ success: false, error: '伺服器錯誤' });
    }
});

// DELETE /api/filters/:id — 刪除篩選器
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        await query('DELETE FROM saved_filters WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        res.json({ success: true, message: '已刪除' });
    } catch (err) {
        console.error('刪除篩選器失敗:', err);
        res.status(500).json({ success: false, error: '伺服器錯誤' });
    }
});

module.exports = router;
