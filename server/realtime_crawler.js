const { query, pool } = require('./db');
const https = require('https');

// 安全檢查：僅在明確啟用爬蟲的環境中執行 (例如本地 WSL)
// 避免在 Zeabur 或其他雲端平台中誤啟動
if (process.env.ENABLE_CRAWLER !== 'true') {
    console.log('[Realtime Crawler] ENABLE_CRAWLER env var not set to true. Exiting safely...');
    process.exit(0);
}

const fetchJson = (url) => new Promise((resolve, reject) => {
    https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
        });
    }).on('error', reject);
});

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function logCrawlerStatus(status, message) {
    try {
        await pool.query(
            `INSERT INTO system_status (service_name, status, message) VALUES ($1, $2, $3)`,
            ['realtime_crawler.js', status, message]
        );
    } catch (err) {
        console.error(`Failed to log crawler status:`, err.message);
    }
}

async function getTargetSymbols() {
    const res = await query("SELECT symbol, market FROM stocks WHERE symbol ~ '^[0-9]{4}$'");
    return res.rows.map(r => ({
        symbol: r.symbol,
        market: r.market,
        prefix: r.market === 'twse' ? 'tse' : 'otc'
    }));
}

function parseFiveLevels(pricesStr, volsStr) {
    if (!pricesStr || !volsStr) return [];
    const prices = pricesStr.split('_').filter(Boolean);
    const vols = volsStr.split('_').filter(Boolean);
    return prices.map((p, i) => ({
        price: p === '-' ? null : parseFloat(p),
        volume: vols[i] ? parseInt(vols[i]) : 0
    })).filter(level => level.price !== null);
}

const BATCH_SIZE = 50;
const DELAY_BETWEEN_BATCHES_MS = 2500;
const RETRY_DELAY = 10000;

async function fetchBatch(batchStr) {
    const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${batchStr}&json=1&delay=0&_=${Date.now()}`;
    try {
        const data = await fetchJson(url);
        return data?.msgArray || [];
    } catch (e) {
        console.error(`Fetch API Error: ${e.message}`);
        return [];
    }
}

/**
 * 解析成交價，當 z 為 "-" 時使用買賣價回退機制
 * @returns {{ price: number|null, source: string }}
 */
function resolvePrice(info) {
    // 1. 優先使用即時成交價 z
    if (info.z && info.z !== '-') {
        const p = parseFloat(info.z);
        if (!isNaN(p) && p > 0) return { price: p, source: 'z' };
    }

    // 2. 回退：使用最佳賣價 (ask[0]) 與最佳買價 (bid[0]) 的中間價
    const asks = info.a ? info.a.split('_').filter(Boolean) : [];
    const bids = info.b ? info.b.split('_').filter(Boolean) : [];
    const bestAsk = asks.length > 0 && asks[0] !== '-' ? parseFloat(asks[0]) : null;
    const bestBid = bids.length > 0 && bids[0] !== '-' ? parseFloat(bids[0]) : null;

    if (bestAsk && bestBid) {
        return { price: parseFloat(((bestAsk + bestBid) / 2).toFixed(2)), source: 'mid' };
    }
    if (bestAsk) return { price: bestAsk, source: 'ask' };
    if (bestBid) return { price: bestBid, source: 'bid' };

    // 3. 最後回退：使用昨收價 y
    if (info.y && info.y !== '-') {
        const yp = parseFloat(info.y);
        if (!isNaN(yp) && yp > 0) return { price: yp, source: 'y' };
    }

    return { price: null, source: 'none' };
}

async function startCrawler() {
    console.log(`[Realtime Crawler] Started. Checking market hours...`);

    while (true) {
        const now = new Date();
        const tpeTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
        const day = tpeTime.getDay();
        const hours = tpeTime.getHours();
        const minutes = tpeTime.getMinutes();
        const isWeekday = day >= 1 && day <= 5;

        const timeInMinutes = hours * 60 + minutes;
        const marketOpen = 8 * 60 + 50;  // 08:50
        const marketClose = 13 * 60 + 35; // 13:35

        if (!isWeekday || timeInMinutes < marketOpen || timeInMinutes > marketClose) {
            console.log(`[Market Closed] Sleeping...`);
            await logCrawlerStatus('WAITING', '休市中，等待開盤');
            await sleep(60000); // Sleep 1 minute
            continue;
        }

        console.log(`[${tpeTime.toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei' })}] Market is OPEN. Fetching full market...`);
        await logCrawlerStatus('RUNNING', '開盤中，持續擷取即時報價...');
        const symbols = await getTargetSymbols();
        console.log(`Total symbols to fetch: ${symbols.length}`);

        let totalUpserted = 0;
        let fallbackCount = 0;

        for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
            const batch = symbols.slice(i, i + BATCH_SIZE);
            const batchStr = batch.map(s => `${s.prefix}_${s.symbol}.tw`).join('|');

            const results = await fetchBatch(batchStr);

            for (const info of results) {
                const { price: resolvedPrice, source: priceSource } = resolvePrice(info);
                if (resolvedPrice === null) continue; // 所有來源都無效，跳過

                if (priceSource !== 'z') fallbackCount++;

                const symbol = info.c;
                const z = resolvedPrice;
                const o = (info.o && info.o !== '-') ? parseFloat(info.o) : resolvedPrice;
                const h = (info.h && info.h !== '-') ? parseFloat(info.h) : resolvedPrice;
                const l = (info.l && info.l !== '-') ? parseFloat(info.l) : resolvedPrice;
                const v = parseInt(info.v) || 0;
                const tv = parseInt(info.tv) || 0;

                const bids = parseFiveLevels(info.b, info.g);
                const asks = parseFiveLevels(info.a, info.f);
                const bidAskData = [];
                for (let k = 0; k < 5; k++) {
                    if (bids[k] || asks[k]) {
                        bidAskData.push({
                            bid: bids[k]?.price || null,
                            bVol: bids[k]?.volume || null,
                            ask: asks[k]?.price || null,
                            aVol: asks[k]?.volume || null
                        });
                    }
                }

                let buyIntensity = 50, sellIntensity = 50;
                if (asks.length > 0 && bids.length > 0 && z) {
                    if (z >= asks[0].price) { buyIntensity = 65; sellIntensity = 35; }
                    else if (z <= bids[0].price) { buyIntensity = 35; sellIntensity = 65; }
                }

                // Parse TWSE timestamp
                // t long ex: 144500
                let tradeTimeStr = info.t;
                // It could be time string, ensure format
                if (tradeTimeStr && tradeTimeStr.length === 6) {
                    tradeTimeStr = `${tradeTimeStr.substring(0, 2)}:${tradeTimeStr.substring(2, 4)}:${tradeTimeStr.substring(4, 6)}`;
                }

                // info.d gives '20260303' -> YYYY-MM-DD
                let tradeDateStr = info.d;
                if (tradeDateStr && tradeDateStr.length === 8) {
                    tradeDateStr = `${tradeDateStr.substring(0, 4)}-${tradeDateStr.substring(4, 6)}-${tradeDateStr.substring(6, 8)}`;
                } else {
                    tradeDateStr = `${tpeTime.getFullYear()}-${String(tpeTime.getMonth() + 1).padStart(2, '0')}-${String(tpeTime.getDate()).padStart(2, '0')}`;
                }

                const fullTimestamp = `${tradeDateStr} ${tradeTimeStr}+08`;

                try {
                    await query(`
                         INSERT INTO realtime_ticks (
                             symbol, trade_time, price, open_price, high_price, low_price, 
                             volume, trade_volume, buy_intensity, sell_intensity, five_levels
                         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                         ON CONFLICT (symbol, trade_time) DO NOTHING
                     `, [symbol, fullTimestamp, z, o, h, l, v, tv, buyIntensity, sellIntensity, JSON.stringify(bidAskData)]);
                    totalUpserted++;
                } catch (err) {
                    console.error(`[DB Error] ${symbol}: ${err.message}`);
                }
            }

            // 微小隨機延遲（降低封阻風險）
            const jitter = Math.floor(Math.random() * 500);
            await sleep(DELAY_BETWEEN_BATCHES_MS + jitter);
        }

        console.log(`[Cycle Complete] Upserted ${totalUpserted} ticks (${fallbackCount} via fallback price).`);
        await logCrawlerStatus('SUCCESS', `擷取完成，新增 ${totalUpserted} 筆（${fallbackCount} 筆使用回退價格）`);
        // Sleep to throttle complete cycles (wait until 1 min elapsed)
        await sleep(10000);
    }
}

startCrawler().catch(console.error);
