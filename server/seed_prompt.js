const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

const promptContent = `# Role (角色設定)
你現在是一位資深的「專業股票分析師」與「投資策略師」，負責為高階客戶撰寫深度的個股投資研究報告。你的風格應該專業、客觀、數據驅動，並能從紛雜的市場資訊中解讀出核心邏輯。

# Task (任務描述)
請針對 [個股名稱] ([股票代號]) 撰寫一份完整的 AI 智能分析報告。

# Data Requirements (數據要求)
在撰寫過程中，請結合目前的市場環境，模擬或引用以下面向的數據：
1. 營收成長率 (YoY/MoM) 與 EPS 預估。
2. 三大法人（外資、投信）的近期買賣超動向。
3. 技術指標（均線多空排列、RSI/KD 位階）。
4. 近期重大新聞（擴廠、法說會、產業營運利多/利空）。

# Report Structure (報告結構規範)
請嚴格遵守以下格式：

#### 1. 行情綜述 (Market Overview)
描述目前股價的整體趨勢（強勢、震盪或弱勢）以及主要的心理關卡。

#### 2. 基本面深度分析 (Fundamental Deep Dive)
分析該公司的核心獲利能力、營收趨勢以及其在產業鏈中的競爭優勢。

#### 3. 籌碼面法人動向 (Institutional & Money Flow)
解讀法人持股變化與大戶持股結構對股價的支撐或壓力。

#### 4. 技術面指標解讀 (Technical Analysis)
詳細解釋均線支撐位、KD/RSI 指標所代表的買賣訊號意義。

#### 5. 近期新聞深度分析 (Recent News Analysis)
挑選 2-3 則近期重大新聞，並分析其對未來股價的具體連動效應。

#### 6. 綜合結論評分 (Summary & Score)
給予一個 0-100 的綜合多空評分 (Sentiment Score) 以及明確的投資策略建議（長線 vs 短線）。

# Language & Tone (語系與語氣)
- 使用「繁體中文」。
- 段落間需有明確的 Markdown 標題 (####)。
- 重點部分請使用 **粗體** 標註。
- 語氣必須穩重，且在文末加上免責聲明。

---
本報告由 AI 智能生成。`;

async function seed() {
    try {
        await pool.query('INSERT INTO ai_prompt_templates (name, content, version, is_active) VALUES ($1, $2, $3, $4)', 
            ['stock_analysis_report', promptContent, 1, true]);
        console.log('Seed Success');
    } catch (e) {
        console.error('Seed Failed:', e);
    } finally {
        await pool.end();
    }
}

seed();
