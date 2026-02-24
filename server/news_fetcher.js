const { pool } = require('./db');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const CATEGORIES = {
    'headline': '熱門頭條',
    'tw_stock': '台股新聞',
    'us_stock': '美股雷達',
    'tech': '科技產業',
    'intl_macro': '全球時事'
};

async function fetchCategoryNews(categoryId) {
    const url = `https://api.cnyes.com/media/api/v1/newslist/category/${categoryId}?limit=20`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return data.items.data || [];
    } catch (err) {
        console.error(`[NewsFetcher] Failed to fetch category ${categoryId}:`, err.message);
        return [];
    }
}

async function saveNews(newsItems, categoryId) {
    const client = await pool.connect();
    try {
        let newCount = 0;
        for (const item of newsItems) {
            const newsId = item.newsId;
            const title = item.title;
            const summary = item.summary || '';
            const publishAt = new Date(item.publishAt * 1000);
            const imageUrl = item.coverSrc?.['xs']?.src || item.coverSrc?.['s']?.src || item.coverSrc?.['m']?.src || '';

            // 這裡我們先存 Summary，若需要全文可在之後擴充爬蟲
            const res = await client.query(`
                INSERT INTO news (news_id, category, title, summary, image_url, publish_at)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (news_id) DO NOTHING
            `, [newsId, categoryId, title, summary, imageUrl, publishAt]);

            if (res.rowCount > 0) newCount++;
        }
        return newCount;
    } catch (err) {
        console.error(`[NewsFetcher] Error saving news for ${categoryId}:`, err.message);
        return 0;
    } finally {
        client.release();
    }
}

async function syncAllNews() {
    console.log('📰 [NewsFetcher] Starting hourly news sync...');
    for (const [catId, catName] of Object.entries(CATEGORIES)) {
        const items = await fetchCategoryNews(catId);
        if (items.length > 0) {
            const saved = await saveNews(items, catId);
            console.log(`✅ [NewsFetcher] ${catName}: Synced ${items.length} items, ${saved} new.`);
        }
    }
    console.log('📰 [NewsFetcher] News sync completed.');
}

module.exports = { syncAllNews };
