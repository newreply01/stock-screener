const { pool } = require('../db');

/**
 * 新聞情緒匯總引擎
 */
const SentimentAggregator = {
    /**
     * 獲取個股近期的綜合新聞情緒
     * @param {string} symbol 股票代號
     * @param {number} days 追蹤天數 (預設 3 天)
     */
    async getAggregatedSentiment(symbol, days = 3) {
        try {
            const res = await pool.query(`
                SELECT 
                    s.sentiment, 
                    s.score, 
                    s.method,
                    n.publish_at,
                    n.title
                FROM news_stock_sentiment s
                JOIN news n ON s.news_id = n.news_id
                WHERE s.symbol = $1 
                  AND n.publish_at >= NOW() - INTERVAL '${days} days'
                ORDER BY n.publish_at DESC
            `, [symbol]);

            const records = res.rows;
            if (records.length === 0) {
                return {
                    symbol,
                    count: 0,
                    avgScore: 0,
                    sentimentLabel: 'Neutral',
                    description: '近期無相關新聞情緒紀錄'
                };
            }

            const totalCount = records.length;
            const avgScore = records.reduce((acc, cur) => acc + parseFloat(cur.score), 0) / totalCount;
            const bullishCount = records.filter(r => r.sentiment === 'Bullish').length;
            const bearishCount = records.filter(r => r.sentiment === 'Bearish').length;

            let sentimentLabel = 'Neutral';
            if (avgScore >= 0.3) sentimentLabel = 'Bullish';
            else if (avgScore > 0.1) sentimentLabel = 'Mildly Bullish';
            else if (avgScore <= -0.3) sentimentLabel = 'Bearish';
            else if (avgScore < -0.1) sentimentLabel = 'Mildly Bearish';

            return {
                symbol,
                count: totalCount,
                avgScore: parseFloat(avgScore.toFixed(2)),
                sentimentLabel,
                bullishCount,
                bearishCount,
                latestNews: records.slice(0, 3).map(r => ({
                    title: r.title,
                    score: r.score,
                    sentiment: r.sentiment
                })),
                description: `近 ${days} 天共 ${totalCount} 則新聞，利多 ${bullishCount} 則 / 利空 ${bearishCount} 則，綜合情緒值為 ${avgScore.toFixed(2)}。`
            };
        } catch (err) {
            console.error(`[SentimentAggregator] Error for ${symbol}:`, err.message);
            return null;
        }
    }
};

module.exports = SentimentAggregator;
