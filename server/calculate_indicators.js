const { query, end } = require('./db');
const { SMA, RSI, MACD, bullishengulfingpattern, bearishengulfingpattern, bullishhammerstick, hangingman, morningstar, eveningstar, threewhitesoldiers, threeblackcrows, piercingline } = require('technicalindicators');

/**
 * 計算並更新所有股票的技術指標
 */
async function calculateAndStoreIndicators() {
    try {
        console.log('🚀 開始計算技術指標...');

        // 1. 取得所有股票代碼
        const stocksRes = await query('SELECT symbol FROM stocks');
        const stocks = stocksRes.rows;
        console.log(`📋 共找到 ${stocks.length} 檔股票`);

        for (const stock of stocks) {
            const { symbol } = stock;
            console.log(`🔍 正在計算 ${symbol}...`);

            // 2. 取得歷史價量資料 (由舊到新)
            const pricesRes = await query(`
                SELECT trade_date, open_price, high_price, low_price, close_price 
                FROM daily_prices 
                WHERE symbol = $1 
                ORDER BY trade_date ASC
            `, [symbol]);

            const prices = pricesRes.rows;
            if (prices.length < 60) {
                console.log(`⚠️ ${symbol} 資料不足 (僅 ${prices.length} 筆)，跳過。`);
                continue;
            }

            const closes = prices.map(p => parseFloat(p.close_price));
            const dates = prices.map(p => p.trade_date);

            // 3. 計算 MA
            const ma5 = SMA.calculate({ period: 5, values: closes });
            const ma10 = SMA.calculate({ period: 10, values: closes });
            const ma20 = SMA.calculate({ period: 20, values: closes });
            const ma60 = SMA.calculate({ period: 60, values: closes });

            // 4. 計算 RSI (14)
            const rsi14 = RSI.calculate({ period: 14, values: closes });

            // 5. 計算 MACD (12, 26, 9)
            const macdResult = MACD.calculate({
                values: closes,
                fastPeriod: 12,
                slowPeriod: 26,
                signalPeriod: 9,
                SimpleMAOscillator: false,
                SimpleMASignal: false
            });

            // 6. 批次存入資料庫 (這裡針對最新一筆或歷史全補)
            // 為了簡化與效能，我們先處理「最新一筆」資料
            const latestIdx = dates.length - 1;
            const latestDate = dates[latestIdx];

            // 取得對應指標的最後一個值
            const getVal = (arr, offset = 0) => arr.length > 0 ? arr[arr.length - 1 - offset] : null;

            const currentRSI = getVal(rsi14);
            const currentMACD = macdResult.length > 0 ? macdResult[macdResult.length - 1] : null;
            const currentMA5 = getVal(ma5);
            const currentMA10 = getVal(ma10);
            const currentMA20 = getVal(ma20);
            const currentMA60 = getVal(ma60);

            // 6. 計算 K線型態 (取最後五筆, piercingline 需要 5 根 K 棒)
            const safeCheck = (fn, inp) => { try { return fn(inp); } catch (e) { return false; } };
            let currentPatterns = [];
            if (closes.length >= 5) {
                const len = closes.length;
                const opens = prices.map(p => parseFloat(p.open_price));
                const highs = prices.map(p => parseFloat(p.high_price));
                const lows = prices.map(p => parseFloat(p.low_price));

                const input = {
                    open: opens.slice(len - 5, len).map(v => parseFloat(v)),
                    high: highs.slice(len - 5, len).map(v => parseFloat(v)),
                    low: lows.slice(len - 5, len).map(v => parseFloat(v)),
                    close: closes.slice(len - 5, len).map(v => parseFloat(v))
                };

                const patternsFound = [];
                // 確保輸入資料完整且沒有 NaN
                const isValidInput = input.open.every(v => !isNaN(v)) && input.high.every(v => !isNaN(v));

                if (isValidInput) {
                    if (safeCheck(bullishengulfingpattern, input)) patternsFound.push('bullish_engulfing');
                    if (safeCheck(bearishengulfingpattern, input)) patternsFound.push('bearish_engulfing');
                    if (safeCheck(bullishhammerstick, input)) patternsFound.push('hammer');
                    if (safeCheck(hangingman, input)) patternsFound.push('hanging_man');
                    if (safeCheck(morningstar, input)) patternsFound.push('morning_star');
                    if (safeCheck(eveningstar, input)) patternsFound.push('evening_star');
                    if (safeCheck(threewhitesoldiers, input)) patternsFound.push('red_three_soldiers');
                    if (safeCheck(threeblackcrows, input)) patternsFound.push('three_black_crows');
                    if (safeCheck(piercingline, input)) patternsFound.push('piercing_line');
                }

                currentPatterns = patternsFound;
            }

            if (currentRSI && currentMA60) {
                await query(`
                    INSERT INTO indicators (
                        symbol, trade_date, rsi_14, 
                        macd_value, macd_signal, macd_hist, 
                        ma_5, ma_10, ma_20, ma_60, patterns
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    ON CONFLICT (symbol, trade_date) DO UPDATE SET
                        rsi_14 = EXCLUDED.rsi_14,
                        macd_value = EXCLUDED.macd_value,
                        macd_signal = EXCLUDED.macd_signal,
                        macd_hist = EXCLUDED.macd_hist,
                        ma_5 = EXCLUDED.ma_5,
                        ma_10 = EXCLUDED.ma_10,
                        ma_20 = EXCLUDED.ma_20,
                        ma_60 = EXCLUDED.ma_60,
                        patterns = EXCLUDED.patterns
                `, [
                    symbol, latestDate, currentRSI,
                    currentMACD?.MACD, currentMACD?.signal, currentMACD?.histogram,
                    currentMA5, currentMA10, currentMA20, currentMA60, JSON.stringify(currentPatterns)
                ]);
            }
        }

        console.log('✅ 技術指標計算與存儲完成。');
    } catch (err) {
        console.error('❌ 計算出錯:', err);
    } finally {
        end();
    }
}

calculateAndStoreIndicators();
