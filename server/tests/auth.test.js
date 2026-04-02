const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret-for-unit-tests-only-32chars';

const { generateToken, requireAuth, optionalAuth, requireRole } = require('../middleware/auth');

// 輔助：建立 mock req/res/next
const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('generateToken', () => {
    it('應產生有效 JWT', () => {
        const user = { id: 1, uuid: 'abc', email: 'test@test.com', name: 'Test', nickname: 'T', role: 'user' };
        const token = generateToken(user);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        expect(decoded.email).toBe('test@test.com');
        expect(decoded.role).toBe('user');
    });
});

describe('requireAuth', () => {
    it('無 Authorization header 應回傳 401', () => {
        const req = { headers: {} };
        const res = mockRes();
        const next = jest.fn();
        requireAuth(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: '請先登入' });
        expect(next).not.toHaveBeenCalled();
    });

    it('無效 token 應回傳 401', () => {
        const req = { headers: { authorization: 'Bearer invalid-token' } };
        const res = mockRes();
        const next = jest.fn();
        requireAuth(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('有效 token 應呼叫 next()', () => {
        const user = { id: 1, uuid: 'abc', email: 'test@test.com', name: 'T', nickname: 'T', role: 'user' };
        const token = generateToken(user);
        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = mockRes();
        const next = jest.fn();
        requireAuth(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(req.user).toBeDefined();
        expect(req.user.email).toBe('test@test.com');
    });
});

describe('optionalAuth', () => {
    it('無 token 也應呼叫 next()', () => {
        const req = { headers: {} };
        const res = mockRes();
        const next = jest.fn();
        optionalAuth(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(req.user).toBeUndefined();
    });

    it('有效 token 應解析使用者', () => {
        const user = { id: 1, uuid: 'abc', email: 'test@test.com', name: 'T', nickname: 'T', role: 'user' };
        const token = generateToken(user);
        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = mockRes();
        const next = jest.fn();
        optionalAuth(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(req.user.email).toBe('test@test.com');
    });

    it('無效 token 應忽略並呼叫 next()', () => {
        const req = { headers: { authorization: 'Bearer bad-token' } };
        const res = mockRes();
        const next = jest.fn();
        optionalAuth(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(req.user).toBeUndefined();
    });
});

describe('requireRole', () => {
    it('未認證應回傳 401', () => {
        const middleware = requireRole('admin');
        const req = {};
        const res = mockRes();
        const next = jest.fn();
        middleware(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
    });

    it('角色不符應回傳 403', () => {
        const middleware = requireRole('admin');
        const req = { user: { role: 'user' } };
        const res = mockRes();
        const next = jest.fn();
        middleware(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('角色匹配應呼叫 next()', () => {
        const middleware = requireRole(['admin', 'moderator']);
        const req = { user: { role: 'admin' } };
        const res = mockRes();
        const next = jest.fn();
        middleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });
});
