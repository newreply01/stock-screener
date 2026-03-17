const { pool } = require('../db');

const premiumPrompt = `# [股票名稱] ([代號]) 深度投資分析報告

#### 1. 個股摘要 (Stock Summary)
分析當前價格動能（多頭續攻/空頭修正/區間震盪）及其相對月線(MA20)的強度。請判讀成交量是否具備「滾量」或「窒息量」特徵。

#### 2. 核心技術面分析 (Technical Engine)
- **趨勢位階**：均線排列狀態、多空發散/收斂情形、股價所處的位階（低檔起漲/高檔噴發）。
- **動能判研**：分析 RSI14 是否進入背離區，以及 MACD 柱狀圖是否出現「由負轉正」或「跌勢衰竭」信號。
- **支撐壓力盤後觀察**：給出具體的短線撐壓位，並評述 K 線型態（如：帶量跳空、長影線回測）。

#### 3. 籌碼深度判讀 (Institutional Synergy)
- **法人聯動**：分析外資與投信買賣力道对比（同向同步、土洋對做）。
- **籌碼集中度變化**：千張大戶持股比例趨勢，研判籌碼是否具備「大戶鎖碼」或「散戶接盤」跡象。
- **融資退潮/進場**：觀察資券變化，排除散戶投機干擾。

#### 4. 基本面與產業加持 (Fundamental Catalyst)
- **獲利與估值**：評論當前 PE/PB 相對於 3-5 年歷史區間的合理性。
- **營收動能**：分析最新 YoY 增長的含金量（是否為產業循環起點或庫存去化完成）。

#### 5. 近期焦點新聞 (Narrative Synthesis)
按照「[主題]: [核心摘要]」格式，彙整分析近二日重要消息，並說明其對未來 1-3 個交易日的潛在情緒影響。

#### 6. 綜合結論與操盤建議 (Strategy & Conclusion)
多空評分: **[總分] / 100**

> [!TIP]
> **趨勢強弱分評**：
> - 技術面 ([分數]/30): [一句話簡評趨勢特徵]
> - 籌碼面 ([分數]/30): [一句話簡評法人意圖]
> - 基本面 ([分數]/30): [一句話簡評成長力道]
> - 新聞面 ([分數]/10): [一句話簡評市場情緒]

**具體操盤策建議：**
- **進場位階**：建議於 **[具體價格區間]** 關鍵支撐區間分批佈局。
- **目標位階**：波段目標可上看 **[目標價]**。
- **風險防衛**：若有效跌破 **[停損價]** 建議減碼觀望。

> [!IMPORTANT]
> 本報告為 AI 智能依據最新盤後數據與新聞動態生成的專業分析。 (更新日期: [日期])`;

async function update() {
    try {
        const result = await pool.query(
            "UPDATE ai_prompt_templates SET content = $1 WHERE name = 'stock_analysis_report' AND is_active = true", 
            [premiumPrompt]
        );
        
        if (result.rowCount === 0) {
            console.error('❌ Active template not found. Inserting new one.');
            await pool.query(
                "INSERT INTO ai_prompt_templates (name, content, is_active) VALUES ('stock_analysis_report', $1, true)",
                [premiumPrompt]
            );
        }
        
        console.log('✅ Premium AI Prompt Template Updated Successfully');
        process.exit(0);
    } catch (err) {
        console.error('❌ Update failed:', err.message);
        process.exit(1);
    }
}

update();
