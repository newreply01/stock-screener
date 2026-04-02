process.env.TZ = 'Asia/Taipei';
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const screenerRoutes = require('./routes/screener');
const authRoutes = require('./routes/auth');
const monitorRoutes = require('./routes/monitor');
const watchlistRoutes = require('./routes/watchlist');
const realtimeRoutes = require('./routes/realtime_query');
const filterRoutes = require('./routes/filters');
const portfolioRoutes = require('./routes/portfolio');
const streamRoutes = require('./routes/stream');
const adminRoutes = require('./routes/admin');
const brokerRoutes = require('./routes/broker_analysis');
const { errorHandler } = require('./middleware/errorHandler');
const { pool } = require('./db');

const app = express();

// ─── Rate Limiting ────────────────────────────────────────────
let rateLimit;
try {
    rateLimit = require('express-rate-limit');
} catch (e) {
    console.warn('[WARN] express-rate-limit 未安裝，Rate Limiting 已停用。執行 npm install express-rate-limit 以啟用。');
}

if (rateLimit) {
    // 全域限制：每個 IP 15 分鐘最多 300 次請求
    const globalLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 300,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, error: '請求太頻繁，請稍後再試' }
    });

    // AI 報告生成嚴格限制：每個 IP 每分鐘最多 5 次
    const aiLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: 5,
        message: { success: false, error: 'AI 報告生成請求過於頻繁，請稍後再試' }
    });

    app.use(globalLimiter);
    app.use('/api/stock/*/generate-ai-report', aiLimiter);
}

// ─── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Health Check ─────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({
            success: true,
            status: 'ok',
            timestamp: new Date().toISOString(),
            services: {
                database: 'ok',
                server: 'ok'
            }
        });
    } catch (err) {
        res.status(503).json({
            success: false,
            status: 'degraded',
            timestamp: new Date().toISOString(),
            services: {
                database: 'error',
                server: 'ok'
            },
            error: err.message || '資料庫連線異常'
        });
    }
});

// ─── API Routes ───────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/monitor', monitorRoutes);
app.use('/api/watchlists', watchlistRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/filters', filterRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/stream', streamRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/broker', brokerRoutes);
app.use('/api', screenerRoutes);
app.use('/api/screener', screenerRoutes); // Alias for frontend compatibility

// ─── Static Frontend ──────────────────────────────────────────
const distPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(distPath));

if (!process.env.VERCEL) {
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) return res.status(404).json({ success: false, error: '找不到該 API 端點' });
        res.sendFile(path.join(distPath, 'index.html'));
    });

    // ─── Global Error Handler ─────────────────────────────────
    app.use(errorHandler);

    if (process.env.NODE_ENV !== 'test') {
        try {
            const { startScheduler } = require('./scheduler');
            startScheduler();
            const PORT = process.env.PORT || 31000;
            app.listen(PORT, '0.0.0.0', () => console.log(`✅ Server started on port ${PORT}`));
        } catch (e) {
            console.error('Failed to start server:', e);
        }
    }
}

module.exports = app;
