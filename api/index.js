const express = require('express');
const app = express();

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        v10: true, 
        time: new Date().toISOString(),
        env: process.env.NODE_ENV
    });
});

app.use((req, res, next) => {
    try {
        // Only require main app if it's NOT a health check
        const mainApp = require('../server/index');
        mainApp(req, res, next);
    } catch (err) {
        console.error('API Error:', err);
        res.status(500).json({ 
            error: 'Server crashed on startup', 
            message: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

module.exports = app;
