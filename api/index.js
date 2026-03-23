process.env.TZ = 'Asia/Taipei';
const express = require('express');
const app = express();

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', v14: true });
});

app.use((req, res, next) => {
    try {
        const mainApp = require('../server/index');
        mainApp(req, res, next);
    } catch (err) {
        console.error('CRITICAL ERROR caught in api/index.js:', err);
        res.status(500).json({ 
            error: 'Server crashed', 
            message: err.message || 'Unknown error occurred during server bootstrap',
            details: err.stack || 'No stack trace available'
        });
    }
});

module.exports = app;
