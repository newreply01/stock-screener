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

const app = express();

app.use(cors());
app.use(express.json());

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

const distPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(distPath));

if (!process.env.VERCEL) {
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
        res.sendFile(path.join(distPath, 'index.html'));
    });
    
    try {
        const { startScheduler } = require('./scheduler');
        startScheduler();
        const PORT = process.env.PORT || 5678;
        app.listen(PORT, '0.0.0.0', () => console.log('Server started on port ' + PORT));
    } catch (e) {
        console.error('Failed to start server:', e);
    }
}

module.exports = app;
