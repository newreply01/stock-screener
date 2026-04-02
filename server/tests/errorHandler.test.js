process.env.JWT_SECRET = 'test-secret-for-unit-tests-only-32chars';
process.env.NODE_ENV = 'test';

const { errorHandler } = require('../middleware/errorHandler');

const mockReq = (method = 'GET', path = '/api/test') => ({
    method,
    originalUrl: path,
});

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.headersSent = false;
    return res;
};

describe('errorHandler', () => {
    it('應回傳統一格式 { success: false, error }', () => {
        const err = new Error('測試錯誤');
        const req = mockReq();
        const res = mockRes();
        const next = jest.fn();
        errorHandler(err, req, res, next);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: false, error: expect.any(String) })
        );
    });

    it('應使用自訂 statusCode', () => {
        const err = new Error('找不到');
        err.statusCode = 404;
        const req = mockReq();
        const res = mockRes();
        const next = jest.fn();
        errorHandler(err, req, res, next);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('headersSent 時應委託給 next()', () => {
        const err = new Error('重複回應');
        const req = mockReq();
        const res = mockRes();
        res.headersSent = true;
        const next = jest.fn();
        errorHandler(err, req, res, next);
        expect(next).toHaveBeenCalledWith(err);
        expect(res.status).not.toHaveBeenCalled();
    });
});
