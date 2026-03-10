const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logActivity } = require('../utils/audit_logger');

// 所有 /api/admin/* 都需要管理員權限
router.use(requireAuth, requireRole('admin'));

// GET /api/admin/users — 取得使用者列表（含關鍵字搜尋、簡單分頁）
router.get('/users', async (req, res) => {
    const { search, role, limit = 50, offset = 0 } = req.query;
    let sql = 'SELECT id, uuid, email, name, nickname, avatar_url, provider, role, created_at FROM users WHERE 1=1';
    const params = [];

    if (search) {
        params.push(`%${search.trim()}%`);
        sql += ` AND (email ILIKE $${params.length} OR nickname ILIKE $${params.length} OR name ILIKE $${params.length})`;
    }

    if (role) {
        params.push(role);
        sql += ` AND role = $${params.length}`;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    try {
        const result = await query(sql, params);
        const countRes = await query('SELECT count(*) FROM users');
        res.json({ 
            success: true, 
            users: result.rows,
            total: parseInt(countRes.rows[0].count)
        });
    } catch (err) {
        console.error('Admin Fetch Users Error:', err);
        res.status(500).json({ success: false, error: '伺服器錯誤' });
    }
});

// GET /api/admin/users/:id/portfolio — 取得指定使用者的自選股資訊
router.get('/users/:id/portfolio', async (req, res) => {
    const { id } = req.params;
    try {
        // 1. 取得該帳號所有自選股清單
        const watchlists = await query(
            'SELECT id, name, created_at FROM watchlists WHERE user_id = $1 ORDER BY created_at ASC',
            [id]
        );

        // 2. 取得所有清單中的個股細節
        const items = await query(
            `SELECT wi.watchlist_id, wi.stock_symbol, s.name as stock_name
             FROM watchlist_items wi
             JOIN stocks s ON wi.stock_symbol = s.symbol
             WHERE wi.watchlist_id IN (SELECT id FROM watchlists WHERE user_id = $1)`,
            [id]
        );

        // 組合資料結構
        const data = watchlists.rows.map(w => ({
            ...w,
            items: items.rows.filter(item => item.watchlist_id === w.id)
        }));

        res.json({ success: true, watchlists: data });
    } catch (err) {
        console.error('Admin Fetch User Portfolio Error:', err);
        res.status(500).json({ success: false, error: '伺服器錯誤' });
    }
});

// GET /api/admin/audit-logs — 取得操作軌跡紀錄
router.get('/audit-logs', async (req, res) => {
    const { user_id, action, limit = 50, offset = 0 } = req.query;
    let sql = `
        SELECT al.*, u.email as user_email, u.nickname as user_nickname 
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.uuid
        WHERE 1=1
    `;
    const params = [];

    if (user_id) {
        params.push(user_id);
        sql += ` AND al.user_id = $${params.length}`;
    }

    if (action) {
        params.push(action);
        sql += ` AND al.action = $${params.length}`;
    }

    sql += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    try {
        const result = await query(sql, params);
        const countRes = await query('SELECT count(*) FROM audit_logs');
        res.json({ 
            success: true, 
            logs: result.rows,
            total: parseInt(countRes.rows[0].count)
        });
    } catch (err) {
        console.error('Admin Fetch Audit Logs Error:', err);
        res.status(500).json({ success: false, error: '伺服器錯誤' });
    }
});

// PUT /api/admin/users/:id — 更新使用者資訊（如變更權限角色）
router.put('/users/:id', async (req, res) => {
    const { id } = req.params;
    const { role, nickname } = req.body;

    if (!role && !nickname) {
        return res.status(400).json({ success: false, error: '未提供更新資訊' });
    }

    try {
        let sql = 'UPDATE users SET updated_at = NOW()';
        const params = [];
        let i = 1;

        if (role) {
            sql += `, role = $${i++}`;
            params.push(role);
        }
        if (nickname) {
            sql += `, nickname = $${i++}`;
            params.push(nickname);
        }

        sql += ` WHERE id = $${i} RETURNING id, uuid, email, nickname, role`;
        params.push(id);

        const result = await query(sql, params);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: '使用者不存在' });
        }

        // 紀錄稽核軌跡
        await logActivity(
            req.user.id, 
            'UPDATE_USER', 
            'user', 
            id, 
            { 
                changes: { role, nickname },
                target_email: result.rows[0].email
            }, 
            req
        );

        res.json({ success: true, user: result.rows[0] });
    } catch (err) {
        console.error('Admin Update User Error:', err);
        res.status(500).json({ success: false, error: '伺服器錯誤' });
    }
});

module.exports = router;
