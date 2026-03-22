const request = require('supertest');

// 測試用模擬 db 連線
jest.mock('../db', () => ({
    pool: { query: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }) },
    query: jest.fn().mockResolvedValue({ rows: [] })
}));

// 設定必要環境變數
process.env.JWT_SECRET = 'test-secret-for-unit-tests-only-32chars';
process.env.NODE_ENV = 'test';

const app = require('../index');

describe('Health Check', () => {
    it('GET /api/health 應回傳 200 及 ok 狀態', async () => {
        const res = await request(app).get('/api/health');
        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toBe(true);
        expect(res.body.status).toBe('ok');
    });
});

describe('Rate Limiting', () => {
    it('API 路由可正常存取', async () => {
        const res = await request(app).get('/api/health');
        expect(res.statusCode).toBeLessThan(500);
    });
});

describe('Admin 路由保護', () => {
    it('GET /api/admin/prompts 未帶 Token 應回傳 401', async () => {
        const res = await request(app).get('/api/admin/prompts');
        expect([401, 403]).toContain(res.statusCode);
    });

    it('POST /api/stock/2330/generate-ai-report 未帶 Token 應回傳 401', async () => {
        const res = await request(app).post('/api/stock/2330/generate-ai-report');
        expect([401, 403]).toContain(res.statusCode);
    });
});

describe('404 Router', () => {
    it('不存在的 API 路徑應回傳 404', async () => {
        const res = await request(app).get('/api/nonexistent-endpoint-xyz');
        expect(res.statusCode).toBe(404);
    });
});
