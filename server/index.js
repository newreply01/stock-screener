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

app.get('/api/debug-db', async (req, res) => {
    const { pool } = require('./db');
    try {
        const dbRes = await pool.query('SELECT 1 as is_alive');
        res.json({
            success: true,
            is_alive: dbRes.rows[0].is_alive,
            has_url: !!(process.env.DATABASE_URL || process.env.POSTGRES_URL),
            host: pool.options.host,
            port: pool.options.port,
            ssl: pool.options.ssl,
            env_keys: Object.keys(process.env).filter(k => k.includes('POSTGRES') || k.includes('DB') || k.includes('DATABASE'))
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message,
            stack: err.stack,
            has_url: !!(process.env.DATABASE_URL || process.env.POSTGRES_URL),
            host: pool.options.host,
            ssl: pool.options.ssl
        });
    }
});

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
