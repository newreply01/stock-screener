const { gatherStockContext, buildEnrichedDataSection } = require('../server/utils/ai_service');
const { pool } = require('../server/db');
const { getTaiwanDate } = require('../server/utils/timeUtils');

const query = (text, params) => pool.query(text, params);

/**
 * Format news items grouped by recency for LLM prompt
 */
function formatNewsWithRecency(news, now) {
    if (!news || news.length === 0) return '近期新聞: 無相關新聞';

    const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const h72 = new Date(now.getTime() - 72 * 60 * 60 * 1000);

    const recent24h = news.filter(n => new Date(n.publish_at) >= h24);
    const recent72h = news.filter(n => { const d = new Date(n.publish_at); return d < h24 && d >= h72; });
    const older = news.filter(n => new Date(n.publish_at) < h72);

    let output = '';
    if (recent24h.length > 0) {
        output += `🔴 最近24小時重要新聞 (對明日開盤影響最大):\n`;
        output += recent24h.slice(0, 5).map(n => `- [${new Date(n.publish_at).toLocaleString('zh-TW')}] ${n.title}`).join('\n');
        output += '\n\n';
    }
    if (recent72h.length > 0) {
        output += `🟡 近1-3天新聞:\n`;
        output += recent72h.slice(0, 3).map(n => `- [${new Date(n.publish_at).toLocaleString('zh-TW')}] ${n.title}`).join('\n');
        output += '\n\n';
    }
    if (older.length > 0 && recent24h.length + recent72h.length < 3) {
        output += `⚪ 較早期新聞 (參考用):\n`;
        output += older.slice(0, 2).map(n => `- [${new Date(n.publish_at).toLocaleString('zh-TW')}] ${n.title}`).join('\n');
        output += '\n';
    }
    return output || '近期新聞: 無相關新聞';
}

async function getRawPrompt(symbol) {
    const DEFAULT_TEMPLATE = `
#### 📝 核心趨勢總結
{0}

#### 📊 技術指標分析
{1}

#### 🧪 基本面深度分析
{2}

#### 🤝 籌碼面法人動向
{3}

#### 📰 相關重要訊息
{4}

#### 💡 綜合結論與投資策略
- **綜合評分: {5} / 100**
- **短線觀點**: {6}
- **操作建議**: {7}
- **風險提醒**: {8}
`;

    try {
        const context = await gatherStockContext(symbol);
        
        // Simulating getPromptTemplate logic from ai_service.js
        const templateRes = await query(
            `SELECT content FROM ai_prompt_templates WHERE name = $1 AND is_active = true LIMIT 1`,
            ['stock_analysis_report']
        );
        const promptTemplate = templateRes.rows.length > 0 ? templateRes.rows[0].content : DEFAULT_TEMPLATE;

        const sentimentText = context.newsSentiment && context.newsSentiment.count > 0 
            ? `新聞情緒 (近 3 天, 時效加權): ${context.newsSentiment.sentimentLabel} (利多: ${context.newsSentiment.bullishCount} 則, 利空: ${context.newsSentiment.bearishCount} 則, 加權分數: ${context.newsSentiment.avgScore})`
            : "新聞情緒: 近期無顯著新聞情緒數據";

        const now = getTaiwanDate();
        const newsFormatted = formatNewsWithRecency(context.news, now);
        const enrichedData = buildEnrichedDataSection(context);

        const finalPrompt = `
你是一位專業的台灣股票投資分析師。請根據以下完整的個股數據與新聞情感分析，按照【報表模板】格式，生成一份深度投資分析報告。

⚠️ 重要指示：
1. 所有數據已完整提供，請直接引用數據分析，不要說「資料未提供」或「資料缺失」
2. 近24小時內的新聞對明日股價影響最大，請在評分和分析中給予顯著權重
3. 請根據近期價格走勢判斷趨勢方向，不要只看單日數據
4. 操盤建議需給出具體價格區間（進場/目標/停損）

${enrichedData}

【新聞情緒分析】
${sentimentText}

${newsFormatted}

【報表模板】:
${promptTemplate}

請嚴格按照模板結構填寫內容。移除「報告生成日」標籤，直接從標題開始。
`;
        console.log("==================== RAW PROMPT START ====================");
        console.log(finalPrompt);
        console.log("==================== RAW PROMPT END ======================");
        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

const symbol = process.argv[2] || '2330';
getRawPrompt(symbol);
