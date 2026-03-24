const { GoogleGenerativeAI } = require("@google/generative-ai");
const { pool } = require('../db');
const { getTaiwanDate, formatTaiwanTime } = require('./timeUtils');
const query = (text, params) => pool.query(text, params);
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "no_key");

/**
 * Gather deep context for AI or Smart Engine
 */
async function gatherStockContext(symbol) {
    try {
        const stockRes = await query(`SELECT name, industry FROM stocks WHERE symbol = $1`, [symbol]);
        const stockInfo = stockRes.rows[0] || { name: '', industry: '' };

        const priceRes = await query(
            `SELECT p.*, i.rsi_14, i.macd_hist, i.ma_5, i.ma_10, i.ma_20, i.ma_60, i.patterns, i.upper_band, i.lower_band
             FROM daily_prices p
             LEFT JOIN indicators i ON p.symbol = i.symbol AND p.trade_date = i.trade_date
             WHERE p.symbol = $1
             ORDER BY p.trade_date DESC
             LIMIT 1`,
            [symbol]
        );
        const priceData = priceRes.rows[0] || {};
        
        const fundamentalRes = await query(
            `SELECT * FROM fundamentals WHERE symbol = $1 ORDER BY trade_date DESC LIMIT 1`,
            [symbol]
        );
        const fundamentals = fundamentalRes.rows[0] || {};

        const instRes = await query(
            `SELECT 
                SUM(foreign_net) as foreign_sum, 
                SUM(trust_net) as trust_sum, 
                SUM(dealer_net) as dealer_sum 
             FROM (SELECT * FROM institutional_2025 WHERE symbol = $1 ORDER BY trade_date DESC LIMIT 5) t`,
            [symbol]
        );
        const institutional = instRes.rows[0] || { foreign_sum: 0, trust_sum: 0, dealer_sum: 0 };

        const marginRes = await query(
            `SELECT margin_purchase_today_balance, short_sale_today_balance 
             FROM fm_margin_trading WHERE stock_id = $1 ORDER BY date DESC LIMIT 1`,
            [symbol]
        );
        const margin = marginRes.rows[0] || { margin_purchase_today_balance: 0, short_sale_today_balance: 0 };

        const revenueRes = await query(
            `SELECT revenue, revenue_month, revenue_year, 
                (SELECT revenue FROM monthly_revenue WHERE symbol = $1 AND revenue_month = r.revenue_month AND revenue_year = r.revenue_year - 1) as prev_y_revenue
             FROM monthly_revenue r WHERE symbol = $1 ORDER BY revenue_year DESC, revenue_month DESC LIMIT 1`,
            [symbol]
        );
        const revenue = revenueRes.rows[0] || {};

        const newsRes = await query(
            `SELECT title, summary, publish_at 
             FROM news 
             WHERE (title ILIKE $1 OR summary ILIKE $1)
             ORDER BY publish_at DESC 
             LIMIT 15`,
            [`%${symbol}%`]
        );
        const news = newsRes.rows;

        return {
            symbol,
            name: stockInfo.name,
            industry: stockInfo.industry,
            priceData,
            fundamentals,
            institutional,
            margin,
            revenue,
            news,
            generatedAt: formatTaiwanTime(),
        };
    } catch (err) {
        console.error("Error gathering stock context:", err);
        throw err;
    }
}

/**
 * Smart Analysis Engine - Replicates the "Very Good" High-Fidelity Report tone.
 */
function generateSmartEngineReport(symbol, context, promptTemplate) {
    // 1. Core Logic & States
    const close = parseFloat(context.priceData.close_price || 0);
    const ma5 = parseFloat(context.priceData.ma_5 || 0);
    const ma20 = parseFloat(context.priceData.ma_20 || 0);
    const ma60 = parseFloat(context.priceData.ma_60 || 0);
    const rsi = parseFloat(context.priceData.rsi_14 || 50);
    const upper = parseFloat(context.priceData.upper_band || 0);
    const lower = parseFloat(context.priceData.lower_band || 0);
    const macd_hist = parseFloat(context.priceData.macd_hist || 0);
    
    // Derived Technical States
    const ma_bullish = ma5 > ma20 && ma20 > ma60;
    const is_rebound = close > ma20;
    const b_percent = (upper - lower) > 0 ? (close - lower) / (upper - lower) : 0.5;
    const vol = parseFloat(context.priceData.volume || 0);
    const volK = (vol / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 });
    
    // Fundamental Data
    const pe = parseFloat(context.fundamentals.pe_ratio || 0);
    const pb = parseFloat(context.fundamentals.pb_ratio || 0);
    const yield_val = parseFloat(context.fundamentals.dividend_yield || 0);
    const y_rev = parseFloat(context.revenue.revenue || 0);
    const py_rev = parseFloat(context.revenue.prev_y_revenue || 0);
    const yoy = py_rev > 0 ? ((y_rev / py_rev - 1) * 100).toFixed(2) : '0';
    
    // Institutional Data
    const f_sum = parseFloat(context.institutional.foreign_sum || 0);
    const t_sum = parseFloat(context.institutional.trust_sum || 0);
    const inst_total = f_sum + t_sum;

    const changeVal = parseFloat(context.priceData.change_amount || 0);
    const changePer = parseFloat(context.priceData.change_percent || 0);
    const changeTxt = changeVal >= 0 ? `上漲 ${changeVal}` : `下跌 ${Math.abs(changeVal)}`;

    // 2. Sections Generation with Varied Phrasing
    
    // Summary
    let summaryText = `【市場動態】${context.name} (${symbol}) 最新收盤價報 ${close} 元，${changeTxt} 點 (${changePer >= 0 ? '+' : ''}${changePer.toFixed(2)}%)。`;
    summaryText += `今日成交量約 ${volK} 張，整體${vol > 50000 ? '換手積極，多空於此價位交戰激烈' : '交投相對平穩'}。`;
    summaryText += `股價目前處於${is_rebound ? '均線上方支撐位，短線維持強勢' : '月線下方整理，需觀察低檔支撐力道'}。`;

    // Technical
    let trendDesc = ma_bullish ? "呈現標準多頭排列，短中長期趨勢同步向上。" : (close > ma60 ? "中期趨勢仍屬震盪偏多，主要考驗短線乖離率之修正。" : "目前處於中長期整理區間，空方勢頭尚未完全止穩。");
    let techText = `趨勢評估: ${trendDesc} 短期關鍵價位落於 MA5 (${ma5.toFixed(1)})。`;
    techText += `\n動能指標: RSI14 目前讀數為 ${rsi.toFixed(1)}，${rsi > 70 ? '已進入超買警示區，需慎防高檔獲利了結壓力。' : (rsi < 30 ? '進入低檔超賣區，具備短線技術性反彈動能。' : '表現穩健，尚未出現偏執訊號。')}`;
    techText += ` MACD 柱狀體(${macd_hist.toFixed(2)})顯示${macd_hist >= 0 ? '多頭動能強勁。' : '空方力道略有收斂。'}`;
    techText += `\n型態判讀: ${context.priceData.patterns && context.priceData.patterns.length > 0 ? '近期觀察到 ' + context.priceData.patterns.join('、') + ' 等型態。' : 'K線型態呈現整理態勢，市場正等待明確的突破方向。'}`;

    // Fundamental
    let fundText = `獲利能力: ${context.revenue.revenue_month ? context.revenue.revenue_month + ' 月' : '最新'}營收 YoY 為 ${yoy}%，實質獲利成長${parseFloat(yoy) > 20 ? '表現亮眼，優於市場預期' : '符合季節性規律'}。`;
    fundText += `\n評價水平: 目前本益比為 ${pe || 'N/A'} 倍，${pe > 20 ? '在產業鏈中估值相對較高，這隱含了市場對其未來高度成長的共識預期。' : '處於相對合理區間。'}`;
    fundText += ` 殖利率約 ${yield_val}%，適合${yield_val > 4 ? '價值投資者長期持有。' : '尋求資本利得的成長型標的。'}`;

    // Institutional
    let chipText = `籌碼動向: 三大法人近期${inst_total > 0 ? '偏多操作' : (inst_total < 0 ? '偏空調節' : '持股穩定')}。`;
    chipText += ` 其中外資持股${f_sum >= 0 ? '穩中有升' : '略有減碼'}，顯示大戶對後市看法${f_sum >= 0 ? '趨於積極' : '轉向保守'}。`;
    chipText += ` 目前內資投信${t_sum > 0 ? '扮演護盤關鍵角色。' : '動向相對不明朗。'}`;

    // News
    const now = getTaiwanDate();
    const twoDaysAgo = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000));
    const recentNews = context.news.filter(n => new Date(n.publish_at) >= twoDaysAgo);
    let newsSection = recentNews.length > 0 ? recentNews.slice(0, 3).map(n => `- ${n.title}`).join('\n') : "近期消息面較為平靜，主要受大盤整體情緒影響。";

    // 3. Scoring (Enhanced Robustness)
    let techScore = ma_bullish ? 25 : (is_rebound ? 18 : 10);
    let fundScore = parseFloat(yoy) > 15 ? 25 : 15;
    let chipScore = inst_total > 0 ? 25 : 15;
    let newsScore = recentNews.length > 0 ? 15 : 10;
    const totalScore = techScore + fundScore + chipScore + newsScore;

    const latestDataDate = context.priceData.trade_date ? new Date(context.priceData.trade_date).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '最新';

    let report = `# ${context.name || ''} (${symbol}) 技術與基本面分析報告

#### 📢 個股摘要
${summaryText}

#### 📈 技術面分析
${techText}

#### 🧪 基本面深度分析
${fundText}

#### 🤝 籌碼面法人動向
${chipText}

#### 📰 相關重要訊息
${newsSection}

#### 💡 綜合結論與投資策略
- **綜合評分: ${totalScore} / 100**
- **短線觀點**: ${totalScore > 80 ? '技術面與籌碼面同步做多，具備突破高點之潛力。' : (totalScore > 50 ? '目前處於多空拉鋸，應觀察支撐價位之有效性。' : '股價弱勢震盪，應耐心等待底部確認。')}
- **操作建議**: 支撐區間建議參考 **${Math.floor(ma20 * 0.985)}-${Math.ceil(ma20 * 1.01)} 元**。
- **風險提醒**: 須特別留意總經變數及產業週期性波動之影響。

> [!NOTE]
> 本報告由升級版 Smart Engine 依據最新資料生成 (資料日期: ${latestDataDate})。
`;

    return report;
}

/**
 * Generate AI report using the active template and gathered data
 */
async function generateAIReport(symbol, templateName = 'stock_analysis_report', manualContext = null) {
    try {
        const context = manualContext || await gatherStockContext(symbol);

        const templateRes = await query(
            `SELECT content FROM ai_prompt_templates WHERE name = $1 AND is_active = true LIMIT 1`,
            [templateName]
        );
        
        if (templateRes.rows.length === 0) {
            throw new Error(`Active template '${templateName}' not found`);
        }
        
        let promptTemplate = templateRes.rows[0].content;

        const hasKey = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 10 && process.env.GEMINI_API_KEY !== 'your_api_key_here';
        
        let finalContent = "";
        let sentimentScore = 50;
        let isFallback = false;

        if (!hasKey) {
            finalContent = generateSmartEngineReport(symbol, context, promptTemplate);
            isFallback = true;
            
            const scoreMatch = finalContent.match(/\*\*(\d+) \/ 100\*\*/);
            if (scoreMatch) sentimentScore = parseInt(scoreMatch[1]);
        } else {
            const inst_dir = (parseFloat(context.institutional.foreign_sum || 0) + parseFloat(context.institutional.trust_sum || 0)) > 0 ? "偏多買進" : "偏空賣出";
            const finalPrompt = `
你是一位專業的股票投資分析師。請根據以下個股詳細數據和新聞，按照指定的【模板格式】生成一份深度投資分析報告。

股票: ${context.name} (${context.symbol})
最新收盤: ${context.priceData.close_price} (漲跌: ${context.priceData.change_amount}, ${parseFloat(context.priceData.change_percent || 0).toFixed(2)}%)
技術面: RSI14=${context.priceData.rsi_14}, Bollinger%b=${((parseFloat(context.priceData.close_price) - parseFloat(context.priceData.lower_band)) / (parseFloat(context.priceData.upper_band) - parseFloat(context.priceData.lower_band))).toFixed(2)}, MACD柱=${context.priceData.macd_hist}, MA5=${context.priceData.ma_5}, MA20=${context.priceData.ma_20}, MA60=${context.priceData.ma_60}
基本面: PE=${context.fundamentals.pe_ratio}, PB=${context.fundamentals.pb_ratio}, 殖利率=${context.fundamentals.dividend_yield}%
營收: 最新月營收 ${context.revenue.revenue} (YoY約 ${context.revenue.prev_y_revenue ? ((parseFloat(context.revenue.revenue)/parseFloat(context.revenue.prev_y_revenue)-1)*100).toFixed(1) : '未知'}%)
籌碼面: 近5日法人合計${inst_dir}, 融資餘額=${context.margin.margin_purchase_today_balance}

新聞:
${context.news.map(n => `- [${n.publish_at}] ${n.title}`).join('\n')}

【報表模板】:
${promptTemplate}

請嚴格按照模板結構填寫內容。移除「報告生成日」標籤，直接從標題開始。
`;
            const model = genAI.getGenerativeModel({ model: "gemini-3.0-flash" });
            const result = await model.generateContent(finalPrompt);
            finalContent = result.response.text();
            
            const scoreMatch = finalContent.match(/評分[^\d]*(\d+)/) || finalContent.match(/Score[^\d]*(\d+)/);
            if (scoreMatch) sentimentScore = parseInt(scoreMatch[1]);
        }

        // Save to current reports table
        await query(
            `INSERT INTO ai_reports (symbol, content, sentiment_score, updated_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (symbol) 
             DO UPDATE SET content = EXCLUDED.content, sentiment_score = EXCLUDED.sentiment_score, updated_at = NOW()`,
            [symbol, finalContent, sentimentScore]
        );

        // Save to history table (daily grain)
        await query(
            `INSERT INTO ai_reports_history (symbol, report_date, content, sentiment_score)
             VALUES ($1, CURRENT_DATE, $2, $3)
             ON CONFLICT (symbol, report_date) 
             DO UPDATE SET content = EXCLUDED.content, sentiment_score = EXCLUDED.sentiment_score`,
            [symbol, finalContent, sentimentScore]
        );

        return { success: true, symbol, content: finalContent, sentimentScore, isFallback };
    } catch (err) {
        console.error("AI/Engine Report Generation Error:", err);
        return { success: false, error: err.message };
    }
}

module.exports = { generateAIReport, generateSmartEngineReport, gatherStockContext };
