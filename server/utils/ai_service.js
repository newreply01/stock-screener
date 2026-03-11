const { GoogleGenerativeAI } = require("@google/generative-ai");
const { query } = require("../db");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Gather all relevant data for a stock to provide context for AI
 */
async function gatherStockContext(symbol) {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        // 1. Get fundamental data
        const fundamentalRes = await query(
            `SELECT * FROM fundamentals WHERE symbol = $1 ORDER BY trade_date DESC LIMIT 1`,
            [symbol]
        );
        const fundamentals = fundamentalRes.rows[0] || {};
        
        // 2. Get latest price and indicators
        const priceRes = await query(
            `SELECT p.*, i.rsi_14, i.macd_hist, i.ma_5, i.ma_10, i.ma_20, i.ma_60, i.patterns
             FROM daily_prices p
             LEFT JOIN indicators i ON p.symbol = i.symbol AND p.trade_date = i.trade_date
             WHERE p.symbol = $1
             ORDER BY p.trade_date DESC
             LIMIT 1`,
            [symbol]
        );
        const priceData = priceRes.rows[0] || {};
        
        // 3. Get recent news (Corrected columns: summary, publish_at)
        const newsRes = await query(
            `SELECT title, summary, publish_at 
             FROM news 
             WHERE (title ILIKE $1 OR summary ILIKE $1)
             ORDER BY publish_at DESC 
             LIMIT 10`,
            [`%${symbol}%`]
        );
        const news = newsRes.rows;

        // 4. Get financial statements summary
        
        return {
            symbol,
            priceData,
            fundamentals,
            news,
            generatedAt: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
        };
    } catch (err) {
        console.error("Error gathering stock context:", err);
        throw err;
    }
}

/**
 * Generate a mock report based purely on the prompt template structure
 */
function generateMockReport(symbol, context, promptTemplate) {
    let report = promptTemplate;
    
    // Replace custom variables if any (e.g., {symbol})
    report = report.replace(/{symbol}/g, symbol);
    // Try to replace {name} if possible, or just remove it if not available
    const nameMatch = context.news ? context.news.find(n => n.title.includes(symbol)) : null;
    report = report.replace(/{name}/g, ''); 

    // Inject data under headings
    report = report.replace(/#### 1\. 個股摘要.*/, `$&
- **最新價格**: ${context.priceData.close_price || 'N/A'} (漲跌幅: ${context.priceData.change_percent || '0'}%)
- **成交量**: ${context.priceData.volume || 'N/A'}`);

    report = report.replace(/#### 2\. 技術面分析.*/, `$&
- **動能指標**: RSI14=${context.priceData.rsi_14 || 'N/A'}, MACD柱=${context.priceData.macd_hist || 'N/A'}
- **均線**: MA20=${context.priceData.ma_20 || 'N/A'}, MA60=${context.priceData.ma_60 || 'N/A'}
- **K線型態**: ${context.priceData.patterns ? JSON.stringify(context.priceData.patterns) : '無'}`);

    report = report.replace(/#### 3\. 基本面深度分析.*/, `$&
- **本益比 (PE)**: ${context.fundamentals.pe_ratio || 'N/A'}
- **股價淨值比 (PB)**: ${context.fundamentals.pb_ratio || 'N/A'}
- **現金殖利率**: ${context.fundamentals.dividend_yield ? context.fundamentals.dividend_yield + '%' : 'N/A'}`);

    let newsText = context.news && context.news.length > 0 
        ? context.news.slice(0, 3).map(n => `- ${n.publish_at || ''} ${n.title}`).join('\n') 
        : '- 近期無重大新聞';
        
    report = report.replace(/#### 6\. 近期新聞.*/, `$&
${newsText}`);

    report += `\n\n> [!NOTE]\n> 本報告為系統依據提示詞模板與最新數據自動填寫之模擬範例 (Mock Mode)。`;

    return report;
}

/**
 * Generate AI report using the active template and gathered data
 */
async function generateAIReport(symbol, templateName = 'stock_analysis_report') {
    try {
        // 1. Gather data
        const context = await gatherStockContext(symbol);

        // 2. Get the active prompt template
        const templateRes = await query(
            `SELECT content FROM ai_prompt_templates WHERE name = $1 AND is_active = true LIMIT 1`,
            [templateName]
        );
        
        if (templateRes.rows.length === 0) {
            throw new Error(`Active template '${templateName}' not found`);
        }
        
        let promptTemplate = templateRes.rows[0].content;

        // 3. Check for API key - if missing, use template-based mock
        if (!process.env.GEMINI_API_KEY) {
            console.log(`[AI] Missing API KEY for ${symbol}, generating template-based mock report.`);
            const mockContent = generateMockReport(symbol, context, promptTemplate);
            
            await query(
                `INSERT INTO ai_reports (symbol, content, sentiment_score, updated_at)
                 VALUES ($1, $2, $3, NOW())
                 ON CONFLICT (symbol) 
                 DO UPDATE SET content = EXCLUDED.content, sentiment_score = EXCLUDED.sentiment_score, updated_at = NOW()`,
                [symbol, mockContent, 50]
            );

            return {
                success: true,
                symbol,
                content: mockContent,
                sentimentScore: 50,
                isFallback: true
            };
        }
        
        // 4. Construct the prompt
        const finalPrompt = `
你是一位專業的股票投資分析師。請根據以下提供的個股數據和新聞，按照指定的【模板格式】生成一份深度的個股分析報告。

【個股概況與數據】
股票代號: ${context.symbol}
最新價格: ${context.priceData.close_price || 'N/A'} (漲跌幅: ${context.priceData.change_percent || '0'}%)
成交量: ${context.priceData.volume || 'N/A'}
本益比 (PE): ${context.fundamentals.pe_ratio || 'N/A'}
股價淨值比 (PB): ${context.fundamentals.pb_ratio || 'N/A'}
現金殖利率: ${context.fundamentals.dividend_yield || 'N/A'}%
技術指標: RSI14=${context.priceData.rsi_14 || 'N/A'}, MACD柱=${context.priceData.macd_hist || 'N/A'}, MA20=${context.priceData.ma_20 || 'N/A'}
識別形態: ${JSON.stringify(context.priceData.patterns || [])}

【近期新聞】
${context.news.map(n => `- [${n.publish_at}] ${n.title}: ${n.summary}`).join('\n')}

【報告生成模板】
${promptTemplate}

請嚴格遵守上述模板的架構、標題格式與語氣進行撰寫。不要輸出模板之外的解釋性文字。
`;

        // 5. Call Gemini API
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(finalPrompt);
        const responseText = result.response.text();

        // 6. Sentiment score
        let sentimentScore = 50;
        const scoreMatch = responseText.match(/評分[^\d]*(\d+)/) || responseText.match(/Score[^\d]*(\d+)/);
        if (scoreMatch) {
            sentimentScore = parseInt(scoreMatch[1]);
        }

        // 7. Save report
        await query(
            `INSERT INTO ai_reports (symbol, content, sentiment_score, updated_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (symbol) 
             DO UPDATE SET content = EXCLUDED.content, sentiment_score = EXCLUDED.sentiment_score, updated_at = NOW()`,
            [symbol, responseText, sentimentScore]
        );

        return {
            success: true,
            symbol,
            content: responseText,
            sentimentScore
        };
    } catch (err) {
        console.error("AI Report Generation Error:", err);
        return { success: false, error: err.message };
    }
}

module.exports = { generateAIReport };
