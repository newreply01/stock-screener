const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const screenerRoutes = require('./routes/screener');
const authRoutes = require('./routes/auth');
const monitorRoutes = require('./routes/monitor');
const { startScheduler } = require('./scheduler');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', screenerRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/monitor', monitorRoutes);

const distPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(distPath));

// For local dev fallback
if (!process.env.VERCEL) {
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

const PORT = process.env.PORT || 3000;

if (!process.env.VERCEL) {
    try {
        startScheduler();
        app.listen(PORT, () => console.log('Server started on port ' + PORT));
    } catch (err) {
        console.error('Start error:', err);
    }
}

module.exports = app;

