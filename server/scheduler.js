const cron = require('node-cron');
const { catchUp } = require('./fetcher');
const { syncAllNews } = require('./news_fetcher');

function startScheduler() {
    // 每個交易日 15:30 自動抓取收盤資料
    cron.schedule('30 15 * * 1-5', async () => {
        console.log('⏰ 定時排程開始抓取資料...');
        try {
            await catchUp();
        } catch (err) {
            console.error('排程抓取失敗:', err.message);
        }
    }, {
        timezone: 'Asia/Taipei'
    });

    // 每小時抓取最新新聞
    cron.schedule('0 * * * *', async () => {
        try {
            await syncAllNews();
        } catch (err) {
            console.error('排程新聞抓取失敗:', err.message);
        }
    });

    console.log('📅 排程已啟動：每交易日 15:30 更新行情，每小時更新新聞');
}

module.exports = { startScheduler };
