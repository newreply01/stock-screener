/**
 * 每日自選股自動掃描腳本
 * 
 * 功能：
 * 1. 查找所有使用者的自選股清單
 * 2. 取得不重複的股票代號
 * 3. 批次執行持倉分析
 * 4. 寫入 stock_daily_analysis_results 供前端查詢趨勢
 * 
 * 使用方式：
 *   node server/cron/daily_watchlist_scan.js
 *   或透過 crontab 設定每日盤後 (15:00 後) 自動執行
 */

const { query } = require('../db');
const { analyzePosition } = require('../position_analyzer');

async function dailyScan() {
    const startTime = Date.now();
    console.log(`[${new Date().toISOString()}] 開始每日自選股掃描...`);

    try {
        // 1. 查找所有自選股中不重複的股票代號
        const symbolRes = await query(`
            SELECT DISTINCT wi.stock_symbol as symbol
            FROM watchlist_items wi
            JOIN stocks s ON wi.stock_symbol = s.symbol
            WHERE s.symbol ~ '^[0-9]{4}$'
            ORDER BY wi.stock_symbol
        `);

        const symbols = symbolRes.rows.map(r => r.symbol);
        console.log(`  找到 ${symbols.length} 檔不重複股票待分析`);

        if (symbols.length === 0) {
            console.log('  沒有自選股需要掃描，結束');
            return;
        }

        // 2. 批次分析（每次 10 檔，避免過度負載）
        const batchSize = 10;
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < symbols.length; i += batchSize) {
            const batch = symbols.slice(i, i + batchSize);
            console.log(`  處理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(symbols.length / batchSize)}: ${batch.join(', ')}`);

            const results = await Promise.allSettled(
                batch.map(async (sym) => {
                    const result = await analyzePosition(sym);
                    return result;
                })
            );

            // 3. 將結果寫入資料庫
            for (const res of results) {
                if (res.status === 'fulfilled' && res.value) {
                    const r = res.value;
                    try {
                        await query(`
                            INSERT INTO stock_daily_analysis_results 
                                (symbol, calc_date, overall_score, tech_score, fund_score, chip_score, mom_score, recommendation, signal)
                            VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8)
                            ON CONFLICT (symbol, calc_date) 
                            DO UPDATE SET 
                                overall_score = EXCLUDED.overall_score,
                                tech_score = EXCLUDED.tech_score,
                                fund_score = EXCLUDED.fund_score,
                                chip_score = EXCLUDED.chip_score,
                                mom_score = EXCLUDED.mom_score,
                                recommendation = EXCLUDED.recommendation,
                                signal = EXCLUDED.signal,
                                created_at = NOW()
                        `, [
                            r.symbol,
                            r.composite,
                            r.dimensions.technical.score,
                            r.dimensions.fundamental.score,
                            r.dimensions.chip.score,
                            r.dimensions.momentum.score,
                            r.recommendation,
                            r.signal
                        ]);
                        successCount++;
                    } catch (dbErr) {
                        console.error(`    DB 寫入失敗 ${r.symbol}:`, dbErr.message);
                        errorCount++;
                    }
                } else {
                    errorCount++;
                    console.error(`    分析失敗:`, res.reason?.message || 'Unknown error');
                }
            }

            // 間隔 500ms 避免過度負載
            if (i + batchSize < symbols.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n[${new Date().toISOString()}] 掃描完成！`);
        console.log(`  成功: ${successCount}, 失敗: ${errorCount}, 耗時: ${elapsed}s`);

    } catch (err) {
        console.error('每日掃描發生嚴重錯誤:', err);
    } finally {
        process.exit(0);
    }
}

dailyScan();
