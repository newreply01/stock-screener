const { query } = require('./db');

const newPrompt = `# [股票名稱] ([代號]) 深度投資分析報告

#### 1. 個股摘要 (Stock Summary)
分析價格表現（如：大漲/反彈）、量能體質（成交量變化）及與月線(MA20)的相對關係。

#### 2. 技術面分析 (Technical Analysis)
- 趨勢判讀：分析均線排列（偏多/黃金交叉/盤整）及股價相對於長短期均線的位階。
- 動態指標：分析 RSI14 的位階（中性/超買/超跌）與 MACD 柱狀圖趨勢（收斂/擴張）。
- K線與型態：描述近期 K 線重心與重要型態（如長紅吞噬）。
- 波動度：分析布林通道位階。

#### 3. 基本面深度分析 (Fundamental Deep Dive)
- 估值數據：分析 PE、PB、殖利率，並評論其相對於歷史或產業預期的位階。
- 營收趨勢：列出最新月營收與 YoY 成長率，評論其成長動能。
- 獲利/股利：簡述公司利潤趨勢與配息政策信心。

#### 4. 籌碼面法人動向 (Institutional & Chip Analysis)
分析三大法人（特別是外資/投信）近五日的買賣超行為，並觀察融資餘額與持股結構變化。

#### 5. 大戶/散戶籌碼集中度 (Shareholding Distribution)
描述法人與千張大戶持股比例趨勢（如：由散戶流向法人）。

#### 6. 近期新聞 (News Analysis)
按照「[主題]: [核心摘要]」格式列出近二日重要消息（如：營收新高、產業趨勢、地緣政治），並提供綜合彙整分析。

#### 7. 綜合結論 (Summary & Score)
多空評分: **[總分] / 100**
- 技術面 ([分數]/30): [一句話核心分析]
- 基本面 ([分數]/30): [一句話核心分析]
- 籌碼面 ([分數]/30): [一句話核心分析]
- 新聞面 ([分數]/10): [一句話核心分析]

投資策略建議: 建議在 **[具體價格區間] 元** 關鍵支撐區間分批佈局，目標價可上看先前高點。
風險提醒: 需留意下週美國通膨數據公佈對美股半導體之波動影響，以及地緣政治變數。

> [!NOTE]
> 本報告為AI智能依據最新資料生成 (最新資料日期: [日期])。`;

async function update() {
    try {
        await query("UPDATE ai_prompt_templates SET content = $1 WHERE name = 'stock_analysis_report' AND is_active = true", [newPrompt]);
        console.log('✅ AI Prompt Template Updated Successfully');
        process.exit(0);
    } catch (err) {
        console.error('❌ Update failed:', err.message);
        process.exit(1);
    }
}

update();
