const express = require('express');
const app = express();
app.get('/api/health', (req, res) => res.json({ status: 'ok', v9: true, standalone: true }));
app.use((req, res, next) => {
    try {
        const mainApp = require('../server/index');
        mainApp(req, res, next);
    } catch (err) {
        res.status(500).json({ error: 'Main app load fail', message: err.message, stack: err.stack });
    }
});
module.exports = app;
