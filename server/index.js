const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./db');
const { startScheduler } = require('./scheduler');
const watchlistRoutes = require('./routes/watchlist');
const screenerRoutes = require('./routes/screener');
const filterRoutes = require('./routes/filters');
const authRoutes = require('./routes/auth');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/filters', filterRoutes);
app.use('/api', screenerRoutes);

// 託管靜態檔案 (Vite build output)
const distPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(distPath));

// 所有其他路由導向 index.html (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

async function start() {
    let retries = 0;
    const maxRetries = 10;

    while (retries < maxRetries) {
        try {
            // 啟動時確保 DB 初始化
            await initDatabase();
            console.log('✅ 資料庫連線與初始化成功');
            break;
        } catch (err) {
            retries++;
            console.error(`❌ 資料庫連接失敗 (${retries}/${maxRetries}):`, err.message);
            if (retries < maxRetries) {
                console.log(`⏳ 等待 5 秒後進行第 ${retries + 1} 次重試...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            } else {
                console.error('💥 達到最大重試次數，無法連接到資料庫，程式終止');
                process.exit(1);
            }
        }
    }

    try {
        const { catchUp } = require('./fetcher');

        // 啟動排程
        startScheduler();

        // 啟動時檢查是否需要補齊資料 (Background)
        setImmediate(() => {
            console.log('🔄 啟動自動補齊檢查...');
            catchUp().catch(err => console.error('補齊失敗:', err));

            console.log('📰 啟動初始新聞抓取...');
            const { syncAllNews } = require('./news_fetcher');
            syncAllNews().catch(err => console.error('新聞抓取失敗:', err));

            console.log('📊 啟動基本面資料補齊 (FinMind)...');
            const { syncAllStocksFinancials } = require('./finmind_fetcher');
            syncAllStocksFinancials().catch(err => console.error('基本面同步失敗:', err));
        });

        app.listen(PORT, () => {
            console.log(`\n🚀 台股篩選器已啟動`);
            console.log(`📡 PORT: ${PORT}`);
        });
    } catch (err) {
        console.error('啟動流程發生錯誤:', err);
        process.exit(1);
    }
}

start();
