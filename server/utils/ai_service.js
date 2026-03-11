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
 * Generate a rule-based fallback report when AI is unavailable
 */
async function generateFallbackReport(symbol, context) {
    const { analyzePosition } = require('../position_analyzer');
    const analysis = await analyzePosition(symbol);
    
    let report = `# ${symbol} 深度投資分析報告 (系統自動分析)\n\n`;
    report += `> [!NOTE]\n> 本報告由系統量化規則引擎自動產生 (Fallback Mode)\n\n`;
    
    // 1. Summary
    report += `#### 1. 個股摘要 (Stock Summary)\n`;
    report += `- 最新價格: ${context.priceData.close_price || 'N/A'} (漲跌幅: ${context.priceData.change_percent || '0'}%)\n`;
    report += `- 成交量: ${context.priceData.volume || 'N/A'}\n\n`;
    
    // 2. Technical
    const tech = analysis.dimensions.technical;
    report += `#### 2. 技術面分析 (Technical Analysis)\n`;
    report += `- **趨勢判讀**: ${tech.details.maAlignment?.ma20 ? (context.priceData.close_price > tech.details.maAlignment.ma20 ? '股價位於 20MA 之上，短線強勢' : '股價位於 20MA 之下，表現較弱') : '動能盤整中'}\n`;
    report += `- **動能指標**: RSI14=${tech.details.rsi?.value || 'N/A'}, MACD=${tech.details.macd?.value || 'N/A'}\n`;
    report += `- **K線型態**: ${tech.details.patterns?.detected?.join(', ') || '無明顯形態'}\n\n`;
    
    // 3. Fundamental
    const fund = analysis.dimensions.fundamental;
    report += `#### 3. 基本面深度分析 (Fundamental Deep Dive)\n`;
    report += `- **估值**: PE=${fund.details.pe?.value || 'N/A'}, PB=${fund.details.pb?.value || 'N/A'}, 殖利率=${fund.details.dividendYield?.value || 'N/A'}%\n`;
    report += `- **指標得分**: ${fund.score}/100\n\n`;
    
    // 4. Chip
    const chip = analysis.dimensions.chip;
    report += `#### 4. 籌碼面法人動向 (Institutional & Chip Analysis)\n`;
    report += `- **三大法人**: 近日累計 ${chip.details.institutional?.total > 0 ? '買超' : '賣超'} ${Math.abs(chip.details.institutional?.total || 0)} 張\n`;
    report += `- **融資券**: 券資比 ${chip.details.margin?.ratioPercent || '0'}%\n\n`;
    
    // 5. News
    report += `#### 6. 近期新聞 (News Analysis)\n`;
    if (context.news && context.news.length > 0) {
        report += context.news.slice(0, 3).map(n => `- ${n.title}`).join('\n') + '\n\n';
    } else {
        report += `- 近期無重大相關新聞\n\n`;
    }
    
    // 6. Conclusion
    report += `#### 7. 綜合結論 (Summary & Score)\n`;
    report += `- **綜合評分**: ${analysis.composite} / 100\n`;
    report += `- **操作建議**: ${analysis.recommendation}\n`;
    report += `- **分析報告**: ${analysis.composite >= 60 ? '目前籌碼與技術面表現尚佳，建議謹慎偏多操作。' : '目前指標轉弱或盤整，建議觀望或適度減碼。'}\n`;
    
    return {
        content: report,
        sentimentScore: analysis.composite,
        isFallback: true
    };
}

/**
 * Generate AI report using the active template and gathered data
 */
async function generateAIReport(symbol, templateName = 'stock_analysis_report') {
    try {
        // 1. Gather data
        const context = await gatherStockContext(symbol);

        // 2. Check for API key
        if (!process.env.GEMINI_API_KEY) {
            console.log(`[AI] Missing API KEY for ${symbol}, using rule-based fallback.`);
            const fallbackResult = await generateFallbackReport(symbol, context);
            
            // Save fallback report
            await query(
                `INSERT INTO ai_reports (symbol, content, sentiment_score, updated_at)
                 VALUES ($1, $2, $3, NOW())
                 ON CONFLICT (symbol) 
                 DO UPDATE SET content = EXCLUDED.content, sentiment_score = EXCLUDED.sentiment_score, updated_at = NOW()`,
                [symbol, fallbackResult.content, parseInt(fallbackResult.sentimentScore) || 50]
            );

            return {
                success: true,
                symbol,
                content: fallbackResult.content,
                sentimentScore: fallbackResult.sentimentScore,
                isFallback: true
            };
        }

        // 3. Get the active prompt template
        const templateRes = await query(
            `SELECT content FROM ai_prompt_templates WHERE name = $1 AND is_active = true LIMIT 1`,
            [templateName]
        );
        
        if (templateRes.rows.length === 0) {
            throw new Error(`Active template '${templateName}' not found`);
        }
        
        let promptTemplate = templateRes.rows[0].content;
        
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
