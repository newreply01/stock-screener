# 台股篩選器 (Stock Screener)

這是一個基於 Node.js 與 React 的台股篩選器系統，整合了 FinMind Data 與 TWSE 資料來源。

## 1. 專案架構

-   **Backend (Express)**: 位於 \server/\ 目錄。
    -   負責 API 服務、資料庫交互。
    -   包含 \scheduler.js\ 排程系統，自動抓取 FinMind 與新聞資料。
-   **Frontend (React + Vite)**: 位於 \client/\ 目錄。
    -   提供圖表與選股介面。
    -   透過 Vite Proxy 轉發 API 請求至後端。
-   **Database (PostgreSQL)**: 儲存股票基本面、K 線、三大法人等資料。

## 2. 通訊埠 (Ports) 配置

-   **Backend**: 預設監聽在 \10000\ 埠。
-   **Frontend**: 預設監聽在 \20000\ 埠。

## 3. 啟動方式

本專案在 WSL 環境中運行，建議使用 \	mux\ 進行管理。

### 啟動後端
\\ash
cd /home/xg/stock-screener
tmux new-session -d -s stock-backend 'node server/index.js'
\
### 啟動前端 (開發模式)
\\ash
cd /home/xg/stock-screener/client
tmux new-session -d -s stock-frontend 'npm run dev -- --host 0.0.0.0 --port 20000'
\
### 手動觸發資料同步
\\ash
node server/start_finmind_sync.js
\
## 4. 連結方式 (URLs)

服務啟動後，請從 Windows 瀏覽器訪問：
-   **Web 介面**: [http://localhost:20000](http://localhost:20000)
-   **API 端點**: [http://localhost:10000/api](http://localhost:10000/api)

## 5. 注意事項

-   **環境變數**: 請確保 \.env\ 檔案包含有效的 \FINMIND_TOKENS\。
-   **頻率限制**: FinMind API 每小時有 **600 筆** 請求限制。
-   **WSL 網路**: 埠號會自動從 WSL 轉發至 Windows localhost。

