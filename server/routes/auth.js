const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const { query } = require('../db');
const { generateToken, requireAuth } = require('../middleware/auth');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// POST /api/auth/register — Email + 密碼註冊
router.post('/register', async (req, res) => {
    const { email, password, name } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, error: '請輸入 Email 和密碼' });
    }
    if (password.length < 6) {
        return res.status(400).json({ success: false, error: '密碼至少需要 6 個字元' });
    }

    try {
        // 檢查是否已註冊
        const existing = await query('SELECT id FROM users WHERE email = $1 AND provider = $2', [email, 'local']);
        if (existing.rows.length > 0) {
            return res.status(409).json({ success: false, error: '此 Email 已被註冊' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const displayName = name || email.split('@')[0];

        const result = await query(
            `INSERT INTO users (email, password_hash, name, provider) 
             VALUES ($1, $2, $3, 'local') RETURNING id, email, name, avatar_url, provider`,
            [email, passwordHash, displayName]
        );

        const user = result.rows[0];

        // 為新使用者自動建立預設自選股清單
        await query('INSERT INTO watchlists (name, user_id) VALUES ($1, $2)', ['我的自選股', user.id]);

        const token = generateToken(user);
        res.json({ success: true, token, user: { id: user.id, email: user.email, name: user.name, avatar_url: user.avatar_url } });
    } catch (err) {
        console.error('註冊失敗:', err);
        res.status(500).json({ success: false, error: '伺服器錯誤' });
    }
});

// POST /api/auth/login — Email + 密碼登入
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, error: '請輸入 Email 和密碼' });
    }

    try {
        const result = await query(
            'SELECT id, email, name, avatar_url, password_hash, provider FROM users WHERE email = $1 AND provider = $2',
            [email, 'local']
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, error: '帳號或密碼錯誤' });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ success: false, error: '帳號或密碼錯誤' });
        }

        const token = generateToken(user);
        res.json({ success: true, token, user: { id: user.id, email: user.email, name: user.name, avatar_url: user.avatar_url } });
    } catch (err) {
        console.error('登入失敗:', err);
        res.status(500).json({ success: false, error: '伺服器錯誤' });
    }
});

// POST /api/auth/google — Google Sign-In (前端傳送 credential token)
router.post('/google', async (req, res) => {
    const { credential } = req.body;

    if (!credential) {
        return res.status(400).json({ success: false, error: '缺少 Google credential' });
    }

    try {
        // 驗證 Google ID Token
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const { sub: googleId, email, name, picture } = payload;

        // 檢查是否已有此 Google 帳號
        let result = await query(
            'SELECT id, email, name, avatar_url, provider FROM users WHERE provider = $1 AND provider_id = $2',
            ['google', googleId]
        );

        let user;
        if (result.rows.length > 0) {
            // 已註冊，更新資訊
            user = result.rows[0];
            await query(
                'UPDATE users SET name = $1, avatar_url = $2, updated_at = NOW() WHERE id = $3',
                [name, picture, user.id]
            );
            user.name = name;
            user.avatar_url = picture;
        } else {
            // 新使用者
            const insertResult = await query(
                `INSERT INTO users (email, name, avatar_url, provider, provider_id) 
                 VALUES ($1, $2, $3, 'google', $4) RETURNING id, email, name, avatar_url, provider`,
                [email, name, picture, googleId]
            );
            user = insertResult.rows[0];

            // 為新使用者自動建立預設自選股清單
            await query('INSERT INTO watchlists (name, user_id) VALUES ($1, $2)', ['我的自選股', user.id]);
        }

        const token = generateToken(user);
        res.json({ success: true, token, user: { id: user.id, email: user.email, name: user.name, avatar_url: user.avatar_url } });
    } catch (err) {
        console.error('Google 登入失敗:', err);
        res.status(401).json({ success: false, error: 'Google 驗證失敗' });
    }
});

// GET /api/auth/me —// 取得目前使用者資訊
router.get('/me', requireAuth, async (req, res) => {
    try {
        const { rows } = await query('SELECT id, email, name, avatar_url, provider, created_at FROM users WHERE id = $1', [req.user.id]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: '使用者不存在' });
        }
        res.json({ success: true, user: rows[0] });
    } catch (err) {
        console.error('Fetch me error:', err);
        res.status(500).json({ success: false, error: '伺服器錯誤' });
    }
});

// 更新使用者資訊 (名稱)
router.put('/me', requireAuth, async (req, res) => {
    const { name } = req.body;
    if (!name || name.trim() === '') {
        return res.status(400).json({ success: false, error: '名稱不能為空' });
    }
    try {
        const { rows } = await query(
            'UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, name, avatar_url, provider',
            [name.trim(), req.user.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: '使用者不存在' });
        }
        res.json({ success: true, user: rows[0] });
    } catch (err) {
        console.error('Update me error:', err);
        res.status(500).json({ success: false, error: '伺服器錯誤' });
    }
});

// 更新使用者密碼
router.put('/password', requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
        return res.status(400).json({ success: false, error: '請提供有效的密碼' });
    }
    try {
        const { rows } = await query(
            'SELECT password_hash, provider FROM users WHERE id = $1',
            [req.user.id]
        );
        if (rows.length === 0) return res.status(404).json({ success: false, error: '使用者不存在' });

        const user = rows[0];
        if (user.provider !== 'local') {
            return res.status(400).json({ success: false, error: '第三方登入的帳號無法修改密碼' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ success: false, error: '目前密碼不正確' });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(newPassword, salt);

        await query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [hash, req.user.id]
        );
        res.json({ success: true, message: '密碼已更新' });
    } catch (err) {
        console.error('Update password error:', err);
        res.status(500).json({ success: false, error: '伺服器錯誤' });
    }
});

module.exports = router;
