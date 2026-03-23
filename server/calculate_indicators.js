const { query, end } = require('./db');
const { 
    SMA, RSI, MACD, Stochastic, BollingerBands,
    bullishengulfingpattern, bearishengulfingpattern, bullishhammerstick, 
    hangingman, morningstar, eveningstar, threewhitesoldiers, 
    threeblackcrows, piercingline 
} = require('technicalindicators');

/**
 * 計算並更新所有股票的技術指標
 */
async function calculateAndStoreIndicators() {
    try {
        console.log('🚀 開始計算技術指標...');

        // 1. 取得所有股票代碼
        const stocksRes = await query("SELECT symbol FROM stocks WHERE symbol ~ '^(\\d{4,5}|00\\d{4})$'");
        const stocks = stocksRes.rows;
        console.log(`📋 共找到 ${stocks.length} 檔股票`);

        for (const stock of stocks) {
            const { symbol } = stock;
            // console.log(`🔍 正在計算 ${symbol}...`);

            // 2. 取得歷史價量資料 (由舊到新)
            const pricesRes = await query(`
                SELECT trade_date, open_price, high_price, low_price, close_price, volume
                FROM daily_prices 
                WHERE symbol = $1 
                ORDER BY trade_date ASC
            `, [symbol]);

            const prices = pricesRes.rows;
            if (prices.length < 60) {
                // console.log(`⚠️ ${symbol} 資料不足 (僅 ${prices.length} 筆)，跳過。`);
                continue;
            }

            const opens = prices.map(p => parseFloat(p.open_price));
            const highs = prices.map(p => parseFloat(p.high_price));
            const lows = prices.map(p => parseFloat(p.low_price));
            const closes = prices.map(p => parseFloat(p.close_price));
            const volumes = prices.map(p => parseFloat(p.volume) || 0);
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

            // 6. 計算 KD (9, 3, 3)
            const kdResult = Stochastic.calculate({
                high: highs,
                low: lows,
                close: closes,
                period: 9,
                signalPeriod: 3
            });

            // 7. 計算 Bollinger Bands (20, 2)
            const bbResult = BollingerBands.calculate({
                period: 20,
                values: closes,
                stdDev: 2
            });

            // 8. 計算 IBS (Internal Bar Strength)
            // 公式: (收盤 - 最低) / (最高 - 最低)
            const ibsList = prices.map(p => {
                const h = parseFloat(p.high_price);
                const l = parseFloat(p.low_price);
                const c = parseFloat(p.close_price);
                return (h - l) > 0 ? (c - l) / (h - l) : 0.5;
            });

            // 9. 計算量能比 (當前量 / 5日均量)
            const volSMA5 = SMA.calculate({ period: 5, values: volumes });

            // 10. 批次存入資料庫 (這裡針對最新一筆)
            const latestIdx = dates.length - 1;
            const latestDate = dates[latestIdx];

            // 取得對應指標的最後一個值
            const getVal = (arr) => arr.length > 0 ? arr[arr.length - 1] : null;

            const currentRSI = getVal(rsi14);
            const currentMACD = getVal(macdResult);
            const currentMA5 = getVal(ma5);
            const currentMA10 = getVal(ma10);
            const currentMA20 = getVal(ma20);
            const currentMA60 = getVal(ma60);
            const currentKD = getVal(kdResult);
            const currentBB = getVal(bbResult);
            const currentIBS = ibsList[latestIdx];
            const currentVolRatio = (volSMA5.length > 0 && volSMA5[volSMA5.length - 1] > 0) 
                ? volumes[latestIdx] / volSMA5[volSMA5.length - 1] 
                : 1;

            // 11. 計算 K線型態
            const safeCheck = (fn, inp) => { try { return fn(inp); } catch (e) { return false; } };
            let currentPatterns = [];
            if (closes.length >= 5) {
                const len = closes.length;
                const input = {
                    open: opens.slice(len - 5, len),
                    high: highs.slice(len - 5, len),
                    low: lows.slice(len - 5, len),
                    close: closes.slice(len - 5, len)
                };

                const patternsFound = [];
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
                        ma_5, ma_10, ma_20, ma_60, patterns,
                        k_value, d_value, upper_band, lower_band, ibs, volume_ratio
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                    ON CONFLICT (symbol, trade_date) DO UPDATE SET
                        rsi_14 = EXCLUDED.rsi_14,
                        macd_value = EXCLUDED.macd_value,
                        macd_signal = EXCLUDED.macd_signal,
                        macd_hist = EXCLUDED.macd_hist,
                        ma_5 = EXCLUDED.ma_5,
                        ma_10 = EXCLUDED.ma_10,
                        ma_20 = EXCLUDED.ma_20,
                        ma_60 = EXCLUDED.ma_60,
                        patterns = EXCLUDED.patterns,
                        k_value = EXCLUDED.k_value,
                        d_value = EXCLUDED.d_value,
                        upper_band = EXCLUDED.upper_band,
                        lower_band = EXCLUDED.lower_band,
                        ibs = EXCLUDED.ibs,
                        volume_ratio = EXCLUDED.volume_ratio
                `, [
                    symbol, latestDate, currentRSI,
                    currentMACD?.MACD, currentMACD?.signal, currentMACD?.histogram,
                    currentMA5, currentMA10, currentMA20, currentMA60, JSON.stringify(currentPatterns),
                    currentKD?.k, currentKD?.d, currentBB?.upper, currentBB?.lower, currentIBS, currentVolRatio
                ]);
            }
        }

        console.log('✅ 技術指標計算與存儲完成。');
    } catch (err) {
        console.error('❌ 計算出錯:', err);
    }
}


if (require.main === module) {
    calculateAndStoreIndicators()
        .then(() => {
            console.log('🏁 獨立執行完成。');
            end();
        })
        .catch(err => {
            console.error('Fatal error:', err);
            end();
            process.exit(1);
        });
}

module.exports = { calculateAndStoreIndicators };
