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
        console.error('API Error:', err);
        res.status(500).json({ error: 'Server crashed', message: err.message });
    }
});

module.exports = app;
