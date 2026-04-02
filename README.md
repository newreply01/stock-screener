# 台股篩選器 (Stock Screener)

這是一個基於 Node.js 與 React 的台股篩選器系統，整合了 FinMind Data 與 TWSE 資料來源，並提供即時行情監控與自動化資料同步功能。

## 1. 專案架構

-   **Backend (Express)**: 位於 `server/` 目錄。
    -   提供 API 服務（選股、監控、即時查詢等）。
    -   包含 `scheduler.js` 排程系統，自動執行資料抓取與同步。
-   **Frontend (React + Vite + React Router)**: 位於 `client/` 目錄。
    -   提供儀表板、選股工具及系統監控介面。
    -   生產環境下由後端伺服器併行服務。
    -   支援 URL 路由（可直接透過網址進入各功能頁面）。
-   **Database (PostgreSQL)**: 儲存 K 線、三大法人、融資券、新聞與健診分數。

## 2. 通訊埠 (Ports) 配置

-   **生產環境/監控**: 預設監聽在 `31000` 埠。
-   **前端開發模式 (Vite)**: 預設監聽在 `32000` 埠。
-   **資料庫**: 預設監聽在 `5533` 埠。

## 3. 🚀 從零開始（開發者 Onboarding）

### 前置需求

-   WSL2 (ubuntu_dv)
-   Node.js v25.8.1 (使用 nvm 安裝)
-   PostgreSQL 執行於 5533 埠
-   `.env` 檔案（參考下方範例）

### 環境設定

```bash
# 1. 克隆專案
cd /home/xg && git clone <repo-url> stock-screener
cd stock-screener

# 2. 切換 Node 版本
nvm use  # 讀取 .nvmrc (v25.8.1)

# 3. 安裝後端依賴
npm install

# 4. 安裝前端依賴
npm install --prefix client

# 5. 設定環境變數（複製範本後修改）
cp .env.example .env
# 編輯 .env，填入以下必要欄位：
#   FINMIND_TOKENS=<你的 FinMind API Token>
#   JWT_SECRET=<至少 32 字元的安全亂數>
#   DB_PASSWORD=<你的資料庫密碼>
```

### .env 範本

```env
FINMIND_TOKENS=<your-token>
PORT=31000
DB_HOST=localhost
DB_USER=postgres
DB_NAME=stock_screener
DB_PASSWORD=<your-password>
DB_PORT=5533
ENABLE_CRAWLER=true
TZ=Asia/Taipei
# 安全金鑰（必填，至少 32 字元）
JWT_SECRET=<generate-with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
```

### 啟動與部署 (PM2)

本專案推薦使用 PM2 進行程序管理，可確保服務在崩潰時自動重啟，並支援系統開機自啟動。

#### 1. 啟動服務
```bash
cd /home/xg/stock-screener
# 使用預定義配置啟動 (Port 31000)
npx pm2 start ecosystem.config.cjs
```

#### 2. 設定開機自動啟動 (Auto-startup)
由於 WSL 已開啟 `systemd` 支援，可依照以下步驟設定：
1. **產生啟動腳本**：`npx pm2 startup systemd -u xg --hp /home/xg`
2. **執行指令**：複製並執行上述指令產生的 `sudo` 開頭指令。
3. **保存當前列表**：`npx pm2 save` (此步驟會將當前運行的程序保存至 `~/.pm2/dump.pm2`)。

#### 3. 常用 PM2 指令
| 指令 | 說明 |
|---|---|
| `npx pm2 list` | 查看當前所有程序狀態 |
| `npx pm2 logs` | 查看所有程序日誌 (或 `npx pm2 logs stock-server`) |
| `npx pm2 restart all` | 重啟所有服務 |
| `npx pm2 stop all` | 停止所有服務 |
| `npx pm2 delete all` | 刪除所有程序列表 |

### 啟動開發環境 (Vite)
若需進行前端即時開發，請執行：
```bash
npm run dev      # 啟動後端 (31000) + 前端開發伺服器 (32000)
```


### 建置前端

```bash
npm run build    # 打包 React 前端到 client/dist/
```

## 4. 存取方式 (URLs)

服務啟動後，可由 Windows 瀏覽器訪問：

| 路徑 | 功能 |
|---|---|
| `http://localhost:31000/` | 大盤概覽 |
| `http://localhost:31000/screener` | 股票篩選器 |
| `http://localhost:31000/stock/2330` | 台積電個股詳情 |
| `http://localhost:31000/portfolio` | 投資組合（需登入） |
| `http://localhost:31000/watchlist` | 自選股清單（需登入） |
| `http://localhost:31000/monitor` | 系統監控 |
| `http://localhost:31000/admin/users` | 使用者管理（Admin） |
| `http://localhost:31000/api/health` | 後端 API 健康狀態 |

## 5. 執行測試

後端已導入 Jest 與 Supertest 框架來進行自動化 API 測試：

```bash
cd /home/xg/stock-screener

# 執行所有後端測試
npm test

# 執行特定測試檔（例如 auth.test.js）
npx jest --testPathPattern='server/tests/auth.test.js'
```

## 6. 系統監控功能

您可以透過「系統監控」頁面即時查看：
- **服務狀態**: 資料庫與後端 API 是否正常。
- **資料同步進度**: 各項 FinMind 資料集的最後更新時間。
- **程式執行狀態**: 背景爬蟲與擷取程式的歷史執行紀錄。
- **資料寫入趨勢**: 近 14 天的資料抓取筆數統計。

## 7. 腳本工具說明

請參閱 [`server/scripts/README.md`](server/scripts/README.md) 了解各工具腳本的功能與使用方式。

## 8. 注意事項

-   **環境變數**: `.env` 必須包含 `JWT_SECRET`（強制要求，不可缺少）與 `FINMIND_TOKENS`。
-   **時區處理**: 系統核心邏輯已強制轉換為 `Asia/Taipei`（台灣時間）。
-   **Vercel 部署**: 支援 Vercel 雲端執行，請參考 `vercel.json` 配置。

## 9. 資料庫維護與 Slim DB 遷移

為了符合雲端環境（如 Supabase）的空間限制，本專案提供精煉版資料庫導出方案：

### Slim DB 導出邏輯 (2024+ 精選方案)
- **腳本**: `server/scripts/gen_refined_slim_dump.js`
- **起點**: 2024-01-01 至今。
- **篩選**: 僅包含 4 位數代號個股與 00 開頭之 ETF（排除權證、CB 等發行標的）。
- **優化**: 排除龐大的原始行情表 (`fm_stock_price`) 與歷史比率表 (`fm_stock_per`)，改以 `daily_prices` 摘要表為主。
- **產出**: `refined_2024_slim.sql` (約 240MB)，適合部署至 500MB 限制之 Supabase。

### 本地清理
- **腳本**: `server/scripts/cleanup_local_rows.js`
- **功能**: 同步執行以上篩選邏輯至本地資料庫，並徹底刪除盤中即時資料表 (`realtime_ticks` 分區表)，可釋放 10GB 以上磁碟空間。
171: 
172: ## 10. 標的篩選邏輯 (Target Filtering)
173: 
174: 為確保 AI 生成資源的有效利用與系統效能，本系統在執行「資料掃描」、「AI 報告生成」與「資料暫存」時，會遵循以下篩選規則：
175: 
176: -   **包含對象 (Include)**:
177:     -   **普通個股**: 代號為 4 位數純數字之股票（如 `2330`, `2454`）。
178:     -   **ETF**: 代號以 `00` 開頭之受益憑證（如 `0050`, `0056`, `00919`）。
179: -   **排除對象 (Exclude)**:
180:     -   **權證 / 認購售 (Warrants)**: 5 位數或 6 位數之衍生性金融商品。
181:     -   **可轉債 (CB)**: 代號末尾帶有英文字母或特殊格式。
182:     -   **大盤 / 各類指數**: 僅作為參考數據，不生成獨立 AI 報告。
183: 
184: 此邏輯已整合至 `ai_generation_queue` 任務管理與資料庫清理腳本中。

## 11. AI 報告生成分層架構 (Tiered AI Model)

為了解決全市場 2,100+ 檔標的生成耗時問題，系統採用了 **「分級分流 (Tiering)」** 策略，自動優化運算資源分配：

### 分流規則 (Model Selection)
系統每日 22:30 初始化任務時，會依據當日 **成交量 (Volume)** 進行全市場排名：
- **第一梯隊 (Top 300)**: 成交量排名前 300 檔之熱門股，使用 **`gpt-oss:20b`** 模型。提供最高品質的邏輯推理與深度分析。
- **第二梯隊 (Others)**: 其餘 1,800+ 檔標的，自動分配給 **`qwen3.5:9b`** 模型。具備極快的生成速度，確保每日開盤前完成全市場掃描。

### 任務佇列機制 (Queue System)
- **資料表**: `ai_generation_queue`
- **狀態追蹤**: 支援 `pending` (待處理)、`processing` (處理中)、`completed` (已完成)、`failed` (失敗) 四種狀態。
- **斷點續傳**: 若系統異常重啟，Worker 會自動從最後一個 `pending` 任務繼續執行。

### 運行模式 (Worker Mode)
- **單線程常駐**: 為確保 GPU 顯存 (VRAM) 不溢出，`update_ai_reports.js` 預設以 **單執行緒 (-i 1)** 運行。
- **監控整合**: 任務進度會即時同步至「系統監控」面板，顯示當日已完成百分比與預計剩餘任務。

---
*最後更新日期: 2026-03-30*

## 12. 使用者驗證與信箱註冊系統 (User Authentication)

為確保系統安全性與防止惡意註冊，系統在「在地帳號註冊」流程中導入了 **電子信箱驗證 (Email Verification)** 機制。

### 驗證流程 (Verification Flow)
1. **註冊提交**: 使用者填寫 Email 與密碼，系統會即刻建立一個「未待核 (Unverified)」之帳號。
2. **寄送代碼**: 系統自動產生一組 **6 位數驗證碼**，透過 SMTP 寄送至使用者電子信箱。
3. **輸入代碼**: 使用者於 10 分鐘內輸入代碼，系統比對正確後會正式啟用帳號並核發專屬 JWT Token。

### 安全規範
- **代碼有效期**: 驗證代碼在寄送後 **10 分鐘內有效**，逾時需點擊「重新寄送」。
- **登入防護**: 未完成驗證之帳號將無法登入系統（API 會回傳 `needsVerification` 狀態碼）。
- **第三方登入 (Google)**: 透過 Google Sign-In 註冊者，因為其來源信箱已由 Google 驗證，系統會自動跳過驗證步驟直接啟用。

### 環境變數配置 (SMTP)
要正常啟用發信功能，請務必在 `.env` 中填入以下參數：
```env
# 郵件發送設定 (以 Gmail 為例)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=您的信箱位址
SMTP_PASS=您的應用程式專用密碼
SMTP_FROM_NAME=Stock Screener (系統名稱)
```
*註：若使用 Gmail，請先至 Google 帳戶設定啟用「兩步驟驗證」並產生「應用程式專用密碼」。*

## 13. 新聞情緒辨識與健檢引擎 (News Sentiment Engine v3.0)

系統具備對台股全市場（個股及 ETF）新聞內容進行「語義量化」的能力，並將其深度整合至健檢評分中。

### 核心功能
1. **全市場標點識別**: 自動辨識 **台灣個股 (4位數)** 及 **熱門 ETF (5-6位數)**。
2. **多股關聯技術**: 單一新聞提及多檔股票時，自動分離並產出各別的情緒指標。
3. **AI 語義分析**: 使用 Ollama (qwen3.5:9b) 進行利多/利空定性，產出 -1.0 至 +1.0 之情緒值。
4. **近期熱度匯總 (3天)**: AI 報表生成時，會彙整過去 **3 天** 內該個股的所有情緒紀錄。

## 14. AI 分析報告深度與堆疊化 (Daily Stacking v4.0)

為提供專業級投研觀點，AI 報告生成系統已進行全面邏輯升級。

### 核心特性
1. **每日歷史堆疊**: 報告數據不再覆蓋，改為依據日期 (report_date) 進行存儲。用戶可回溯查看同一標的在不同日期的診斷紀錄。
2. **深度技術解析**: 強制 AI 對 **均線排列、RSI 乖離、MACD 柱狀體、布林帶寬** 及 **K線型態 (Patterns)** 進行交叉逻辑推演。
3. **權重精準校準**: 
    - **新聞情緒權重佔比 40%**：新聞面的利多/利空對最終評分具備顯著影響力。
    - **量化評分偏移**：自動根據 3 天匯總情緒值進行總分增益或減損。
4. **自動重試機制**: 若任務失敗（如 Ollama 超時），系統會記錄錯誤原因並至少自動重試 2 次。
