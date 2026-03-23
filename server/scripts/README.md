# server/scripts/ 腳本說明文件

此目錄包含資料維護、AI 報告批次生成等工具腳本。

## 🟢 持續使用中的腳本

| 腳本 | 說明 | 使用方式 |
|---|---|---|
| `calc_health_scores.js` | 計算全股健診評分並寫入 DB | `node scripts/calc_health_scores.js` |
| `calc_market_focus.js` | 計算市場焦點每日摘要 | `node scripts/calc_market_focus.js` |
| `backfill_fundamentals.js` | 補填歷史基本面資料 | `node scripts/backfill_fundamentals.js` |
| `daily_watchlist_scan.js` (cron/) | 每日自選股掃描通知 | 由 scheduler 呼叫 |

| `remove_warrants_db.js` | 從 DB 移除權證資料 |
| `gen_refined_slim_dump.js` | 產製 2024+ 精煉版 Slim DB (僅個股/ETF) |
| `cleanup_local_rows.js` | 本地資料庫瘦身（移除非精選代號與即時表） |

## 🔴 已完成的一次性腳本 (歷史紀錄)

下列腳本為 AI 報告批次注入的一次性操作，**已執行完畢，無需再執行**：

- `inject_batch_*.js` — 批次注入 AI 報告 (batch 1-13)
- `extract_batch_*.js` — 從 Gemini 提取批次分析結果
- `batch_context_*.json` — 批次分析的原始 context JSON (可移除以節省空間)
- `insert_demo_reports.js` — 插入示範報告
- `regenerate_report.js` — 單股報告重生成

## 📌 注意事項

- 所有腳本需在 `/home/xg/stock-screener` 根目錄下執行
- 需要 `.env` 中的 `DATABASE_URL` 或 `DB_*` 系列環境變數
- 如要釋放磁碟空間，可刪除 `batch_context_*.json` 等大型 JSON 檔案（不影響系統運作）
