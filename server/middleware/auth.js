const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'muchstock-default-secret-change-me';

function generateToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, name: user.name },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

// 強制認證 — 未帶 token 直接 401
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: '請先登入' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, error: 'Token 無效或已過期' });
    }
}

// 選擇性認證 — 有 token 就解析，沒有也放行
function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const token = authHeader.split(' ')[1];
            req.user = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            // token 無效，忽略
        }
    }
    next();
}

module.exports = { generateToken, requireAuth, optionalAuth, JWT_SECRET };
