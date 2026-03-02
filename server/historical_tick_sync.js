/**
 * Historical Intraday Data Sync (FinMind TaiwanStockPriceMinute)
 */

const { pool } = require('./db');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const BASE_URL = 'https://api.finmindtrade.com/api/v4/data';
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const TOKENS = (process.env.FINMIND_TOKENS || process.env.FINMIND_TOKEN || '')
    .split(',').map(t => t.trim()).filter(t => t.length > 0);

let currentTokenIndex = 0;
const exhaustedTokens = new Set();

function getCurrentToken() { return TOKENS.length === 0 ? null : TOKENS[currentTokenIndex]; }

function rotateToken(reason = '') {
    if (TOKENS.length <= 1) return false;
    exhaustedTokens.add(currentTokenIndex);
    for (let i = 1; i < TOKENS.length; i++) {
        const next = (currentTokenIndex + i) % TOKENS.length;
        if (!exhaustedTokens.has(next)) {
            currentTokenIndex = next;
            console.log(`[Token] Switched to Token #${next + 1}/${TOKENS.length} (${reason})`);
            return true;
        }
    }
    console.error(`[Token] All ${TOKENS.length} tokens exhausted`);
    return false;
}

async function fetchFinMind(dataset, data_id = '', start_date = '') {
    const startTime = Date.now();
    let url = `${BASE_URL}?dataset=${dataset}`;
    if (data_id) url += `&data_id=${data_id}`;
    if (start_date) url += `&start_date=${start_date}`;

    const token = getCurrentToken();
    if (token) url += `&token=${token}`;

    console.log(`  [Fetch] ${dataset}/${data_id} from ${start_date} (Token #${currentTokenIndex + 1})`);

    try {
        const res = await fetch(url, { timeout: 180000 });
        if (!res.ok) {
            if (res.status === 429) {
                console.warn(`[FinMind] Rate limited (429) on Token #${currentTokenIndex + 1}`);
                if (rotateToken('HTTP 429')) return fetchFinMind(dataset, data_id, start_date);
                console.warn(`Waiting 60s for rate limit...`);
                await sleep(60000);
                exhaustedTokens.clear();
                return fetchFinMind(dataset, data_id, start_date);
            }
            throw new Error(`HTTP ${res.status}`);
        }

        const json = await res.json();
        const data = json.data || [];
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`  [Data] Records: ${data.length} (${duration}s)`);
        return data;
    } catch (err) {
        console.error(`[FinMind Error] ${dataset}/${data_id}: ${err.message}`);
        return [];
    }
}

async function bulkUpsertRealtimeTicks(client, rows) {
    if (!rows || rows.length === 0) return 0;
    let count = 0;
    const BATCH_SIZE = 1000;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        try {
            await client.query('BEGIN');
            for (const row of batch) {
                // FinMind TaiwanStockPriceMinute returns:
                // date (YYYY-MM-DD HH:mm:ss), stock_id, open, high, low, close, Volume
                const symbol = String(row.stock_id);
                // Prepend timezone +08 to string
                const trade_time = `${row.date}+08`;
                const o = parseFloat(row.open) || null;
                const h = parseFloat(row.high) || null;
                const l = parseFloat(row.low) || null;
                const z = parseFloat(row.close) || null;
                const v = parseInt(row.Volume) || 0;

                await client.query(`
                    INSERT INTO realtime_ticks (
                        symbol, trade_time, price, open_price, high_price, low_price, volume, trade_volume
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (symbol, trade_time) DO NOTHING
                `, [symbol, trade_time, z, o, h, l, v, v]);
                count++;
            }
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK').catch(() => { });
            console.error(`  [DB Error] Batch error: ${e.message}`);
        }
    }
    return count;
}

async function syncHistoricalMinute() {
    const args = process.argv.slice(2);
    const startDate = args.find(a => a.startsWith('--start='))?.split('=')[1] || '2024-01-01';
    const limit = args.find(a => a.startsWith('--limit='))?.split('=')[1] || 10;

    console.log(`[Historical Sync] Started from ${startDate} Limit ${limit} symbols`);

    const client = await pool.connect();

    try {
        const res = await client.query(`SELECT symbol FROM stocks WHERE symbol ~ '^[0-9]{4}$' ORDER BY symbol ASC LIMIT ${limit}`);
        const symbols = res.rows.map(r => r.symbol);

        console.log(`Found ${symbols.length} symbols. Processing...`);

        for (let i = 0; i < symbols.length; i++) {
            const sym = symbols[i];
            console.log(`[${i + 1}/${symbols.length}] Fetching ${sym} minute data...`);
            const data = await fetchFinMind('TaiwanStockPriceMinute', sym, startDate);
            if (data.length > 0) {
                const upsertCount = await bulkUpsertRealtimeTicks(client, data);
                console.log(`  -> Upserted ${upsertCount} minute records to realtime_ticks for ${sym}`);
            }
            // Sleep to avoid rate limiting
            await sleep(1000);
        }
    } catch (e) {
        console.error('Fatal Error:', e);
    } finally {
        client.release();
        console.log('[Historical Sync] Finished.');
        process.exit(0);
    }
}

syncHistoricalMinute();
