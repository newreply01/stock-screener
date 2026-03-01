const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth');
const screenerRoutes = require('./routes/screener');
const { startScheduler } = require('./scheduler');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', screenerRoutes);

// Serve static files from React app
const distPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(distPath));

// All other routes redirect to index.html (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

async function startServer() {
    try {
        console.log('\n🚀 台股篩選器已啟動');

        // Start scheduler
        startScheduler();

        app.listen(PORT, () => {
            console.log(`📡 PORT: ${PORT}`);
        });
    } catch (err) {
        console.error('啟動流程發生錯誤:', err);
        process.exit(1);
    }
}

startServer();
