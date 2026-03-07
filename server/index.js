const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const screenerRoutes = require('./routes/screener');
const authRoutes = require('./routes/auth');
const monitorRoutes = require('./routes/monitor');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', screenerRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/monitor', monitorRoutes);

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
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => console.log('Server started'));
    } catch (e) {}
}

module.exports = app;
