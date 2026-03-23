const { query } = require('../db');

const BULLISH_KEYWORDS = [
    '營收創高', '營收新高', '爆發', '買進', '利多', '上修', '展望佳', '跳空上揚', '獲利噴發',
    '成長', '優於預期', '追進', '看好', '反彈', '轉盈', '訂單滿手', '產能滿載', '亮點',
    '調升目標價', '漲', '大漲', '創新高', '連紅', '突破', '轉強', '法人加碼'
];

const BEARISH_KEYWORDS = [
    '暴跌', '跌破', '賣出', '利空', '下修', '衰退', '裁員', '虧損', '展望保守', '賣壓',
    '低於預期', '看淡', '重挫', '慘', '腰斬', '連倒', '融資斷頭', '空頭', '弱勢', '跳空下跌',
    '調降目標價', '跌', '重跌', '疲軟', '警訊', '壓力', '流失'
];

const NewsSentiment = {
    /**
     * 從新聞標題及摘要中識別個股代碼
     */
    async identifyStocks(title, summary) {
        const text = (title + ' ' + summary);
        const symbols = new Set();
        
        // 1. 優先匹配帶括號的代碼，如 (2330) 或 [2330] - 這是最可靠的
        const bracketRegex = /[\(\[（【](\d{4})[\)\]）】]/g;
        let match;
        while ((match = bracketRegex.exec(text)) !== null) {
            symbols.add(match[1]);
        }
        
        // 2. 匹配獨立的 4 位數字，但需排除年份 (1900-2100)
        // 除非它前面有「代號」或「股票」字眼
        const standaloneRegex = /(?:^|\s|[^0-9])(\d{4})(?:$|\s|[^0-9])/g;
        while ((match = standaloneRegex.exec(text)) !== null) {
            const code = match[1];
            const val = parseInt(code);
            const isYearRange = val >= 1900 && val <= 2100;
            
            // 檢查代碼前 5 個字元是否有「代號/股票/個股」
            const startIndex = match.index;
            const prefix = text.substring(Math.max(0, startIndex - 10), startIndex);
            const hasContext = /代號|股票|個股|#/.test(prefix);

            if (!isYearRange || hasContext) {
                symbols.add(code);
            }
        }
        
        return Array.from(symbols);
    },

    /**
     * 計算情緒分數與標籤
     */
    analyzeSentiment(title, summary) {
        const text = (title + ' ' + summary).toLowerCase();
        let bullCount = 0;
        let bearCount = 0;
        const matchedBull = [];
        const matchedBear = [];

        BULLISH_KEYWORDS.forEach(word => {
            if (text.includes(word)) {
                bullCount++;
                matchedBull.push(word);
            }
        });

        BEARISH_KEYWORDS.forEach(word => {
            if (text.includes(word)) {
                bearCount++;
                matchedBear.push(word);
            }
        });

        let score = 0;
        let sentiment = 'Neutral';
        const total = bullCount + bearCount;

        if (total > 0) {
            score = (bullCount - bearCount) / (total + 0.5); // 稍微正規化
            if (score > 0.1) sentiment = 'Bullish';
            else if (score < -0.1) sentiment = 'Bearish';
        }

        return {
            score: parseFloat(score.toFixed(2)),
            sentiment,
            reason: `利多關鍵字: [${matchedBull.join(', ')}]; 利空關鍵字: [${matchedBear.join(', ')}]`
        };
    },

    /**
     * 處理單則新聞並寫入資料庫
     */
    async processNews(newsId) {
        try {
            const newsRes = await query('SELECT title, summary FROM news WHERE news_id = $1', [newsId]);
            if (newsRes.rows.length === 0) return;

            const { title, summary } = newsRes.rows[0];
            const foundSymbols = await this.identifyStocks(title, summary);
            if (foundSymbols.length === 0) return;

            const analysis = this.analyzeSentiment(title, summary);

            for (const symbol of foundSymbols) {
                // 檢查該個股是否存在於 stocks 表 (避免誤入純數字)
                const stockCheck = await query('SELECT symbol FROM stocks WHERE symbol = $1', [symbol]);
                if (stockCheck.rows.length === 0) continue;

                await query(`
                    INSERT INTO news_stock_sentiment (news_id, symbol, sentiment, score, method, reason)
                    VALUES ($1, $2, $3, $4, 'rule', $5)
                    ON CONFLICT (news_id, symbol) DO UPDATE SET
                        sentiment = EXCLUDED.sentiment,
                        score = EXCLUDED.score,
                        reason = EXCLUDED.reason
                `, [newsId, symbol, analysis.sentiment, analysis.score, analysis.reason]);
            }
            return { newsId, symbols: foundSymbols, analysis };
        } catch (err) {
            console.error(`[NewsSentiment] Error processing news ${newsId}:`, err.message);
        }
    }
};

module.exports = NewsSentiment;
