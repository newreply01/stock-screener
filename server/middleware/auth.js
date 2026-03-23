const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('[CRITICAL] JWT_SECRET 未設定！請在環境變數中加入 JWT_SECRET 以確保認證功能正常。');
}

function generateToken(user) {
    if (!JWT_SECRET) throw new Error('JWT_SECRET 未設定，無法生成 Token');
    return jwt.sign(
        { id: user.id, uuid: user.uuid, email: user.email, name: user.name, nickname: user.nickname, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

// 強制認證 — 未帶 token 直接 401
function requireAuth(req, res, next) {
    if (!JWT_SECRET) {
        return res.status(500).json({ success: false, error: '伺服器設定錯誤 (JWT_SECRET Missing)' });
    }
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

// 角色權限檢查中間件
function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: '請先登入' });
        }
        
        const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, error: '權限不足' });
        }
        
        next();
    };
}

module.exports = { generateToken, requireAuth, optionalAuth, requireRole, JWT_SECRET };
