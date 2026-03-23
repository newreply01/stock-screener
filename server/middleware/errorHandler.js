const app_env = process.env.NODE_ENV || 'development';

/**
 * 全域 Express 錯誤處理中間件
 * 統一回應格式，生產環境隱藏內部錯誤細節
 */
function errorHandler(err, req, res, next) {
    // 記錄錯誤（可整合至 logger）
    console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err.message);
    if (app_env !== 'production') {
        console.error(err.stack);
    }

    // 已送出 headers 就讓 Express 預設處理
    if (res.headersSent) {
        return next(err);
    }

    const statusCode = err.statusCode || err.status || 500;
    const response = {
        success: false,
        error: app_env === 'production'
            ? (statusCode < 500 ? err.message : '伺服器發生錯誤，請稍後再試')
            : err.message,
        code: err.code || undefined
    };

    res.status(statusCode).json(response);
}

/**
 * 404 路由找不到時的處理器
 */
function notFoundHandler(req, res) {
    if (req.path.startsWith('/api')) {
        res.status(404).json({ success: false, error: `找不到 API 端點: ${req.method} ${req.path}` });
    }
    // 非 API 路徑由前端 index.html 處理（已在 index.js 設定）
}

module.exports = { errorHandler, notFoundHandler };
