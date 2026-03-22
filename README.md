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

### 啟動開發環境

```bash
cd /home/xg/stock-screener

# 方式一：PM2 管理（推薦，持久化服務）
npx pm2 start ecosystem.config.cjs
npx pm2 list     # 查看狀態
npx pm2 logs     # 查看日誌

# 方式二：前後端同時開發
npm run dev      # 啟動後端 (31000) + 前端 (32000)
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
