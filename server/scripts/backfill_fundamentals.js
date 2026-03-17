const { Pool } = require('pg');
const fetch = require('node-fetch');
const nodeFetch = fetch.default || fetch;

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'stock_screener',
    password: 'postgres123',
    port: 5432,
});

async function query(text, params) {
    return pool.query(text, params);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const parseNumber = (str) => {
    if (!str || str === '--' || str === 'N/A' || str === '') return null;
    const cleaned = String(str).replace(/,/g, '').replace(/"/g, '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
};

const toDateStr = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
};

const toDateHyphen = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const toRocDate = (d) => {
    const year = d.getFullYear() - 1911;
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
};

async function fetchTWSEFundamentals(dateObj) {
    const dateStr = toDateStr(dateObj);
    const dateHyphen = toDateHyphen(dateObj);
    const url = `https://www.twse.com.tw/rwd/zh/afterTrading/BWIBBU_d?response=json&date=${dateStr}`;
    try {
        const res = await nodeFetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const json = await res.json();
        if (json.stat !== 'OK' || !json.data) return 0;

        const dyIdx = json.fields ? json.fields.indexOf("殖利率(%)") : 2;
        const peIdx = json.fields ? json.fields.indexOf("本益比") : 4;
        const pbIdx = json.fields ? json.fields.indexOf("股價淨值比") : 5;

        let count = 0;
        for (const row of json.data) {
            const symbol = row[0];
            if (!/^\d{4,6}$/.test(symbol)) continue;

            const dividendYield = dyIdx !== -1 ? parseNumber(row[dyIdx]) : null;
            const peRatio = peIdx !== -1 ? parseNumber(row[peIdx]) : null;
            const pbRatio = pbIdx !== -1 ? parseNumber(row[pbIdx]) : null;

            await query(
                `INSERT INTO fundamentals (symbol, trade_date, pe_ratio, dividend_yield, pb_ratio)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (symbol, trade_date) DO UPDATE SET pe_ratio = EXCLUDED.pe_ratio, dividend_yield = EXCLUDED.dividend_yield, pb_ratio = EXCLUDED.pb_ratio`,
                [symbol, dateHyphen, peRatio, dividendYield, pbRatio]
            );
            count++;
        }
        return count;
    } catch (e) {
        console.error(`[TWSE] ${dateStr} failed: ${e.message}`);
        return 0;
    }
}

async function fetchTPExFundamentals(dateObj) {
    const rocDate = toRocDate(dateObj);
    const dateHyphen = toDateHyphen(dateObj);
    const url = `https://www.tpex.org.tw/web/stock/aftertrading/peratio_analysis/pera_result.php?l=zh-tw&o=json&d=${rocDate}`;
    try {
        const res = await nodeFetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const json = await res.json();
        if (!json.tables || json.tables.length === 0) return 0;
        const table = json.tables[0];
        if (!table.data || table.data.length === 0) return 0;

        const dyIdx = table.fields ? table.fields.indexOf("殖利率(%)") : 5;
        const peIdx = table.fields ? table.fields.indexOf("本益比") : 2;
        const pbIdx = table.fields ? table.fields.indexOf("股價淨值比") : 6;

        let count = 0;
        for (const row of table.data) {
            const symbol = row[0];
            if (!/^\d{4,6}$/.test(symbol)) continue;

            const dividendYield = dyIdx !== -1 ? parseNumber(row[dyIdx]) : null;
            const peRatio = peIdx !== -1 ? parseNumber(row[peIdx]) : null;
            const pbRatio = pbIdx !== -1 ? parseNumber(row[pbIdx]) : null;

            await query(
                `INSERT INTO fundamentals (symbol, trade_date, pe_ratio, dividend_yield, pb_ratio)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (symbol, trade_date) DO UPDATE SET pe_ratio = EXCLUDED.pe_ratio, dividend_yield = EXCLUDED.dividend_yield, pb_ratio = EXCLUDED.pb_ratio`,
                [symbol, dateHyphen, peRatio, dividendYield, pbRatio]
            );
            count++;
        }
        return count;
    } catch (e) {
        console.error(`[TPEx] ${dateHyphen} failed: ${e.message}`);
        return 0;
    }
}

async function backfill(daysLimit = 1825) { // default 5 years
    let current = new Date();
    current.setHours(0, 0, 0, 0);

    console.log(`🚀 Starting Backfill of Fundamentals for last ${daysLimit} days...`);
    
    for (let i = 0; i < daysLimit; i++) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            const dateStr = toDateHyphen(current);
            
            // Check if we already have data for this day
            const checkRes = await query('SELECT 1 FROM fundamentals WHERE trade_date = $1 LIMIT 1', [dateStr]);
            if (checkRes.rows.length > 0) {
                console.log(`⏩ [${dateStr}] Already has data, skipping...`);
            } else {
                console.log(`🔍 [${dateStr}] Fetching...`);
                const twseCount = await fetchTWSEFundamentals(current);
                await sleep(2000);
                const tpexCount = await fetchTPExFundamentals(current);
                
                if (twseCount > 0 || tpexCount > 0) {
                    console.log(`✅ [${dateStr}] Updated (TWSE: ${twseCount}, TPEx: ${tpexCount})`);
                    // Record to trading_dates too
                    await query(`INSERT INTO trading_dates (date, description) VALUES ($1, 'Backfilled') ON CONFLICT (date) DO NOTHING`, [dateStr]);
                } else {
                    console.log(`ℹ️ [${dateStr}] No data found (possible market holiday)`);
                }
                await sleep(3000); // 5s total delay between days to be safe
            }
        }
        current.setDate(current.getDate() - 1);
    }
    
    console.log('🎉 Backfill completed!');
    process.exit(0);
}

// CLI usage: node backfill_fundamentals.js [days]
const daysArg = process.argv[2] ? parseInt(process.argv[2]) : 1825;
backfill(daysArg).catch(err => {
    console.error(err);
    process.exit(1);
});
