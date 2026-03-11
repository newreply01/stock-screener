const { pool } = require('./server/db');
const fetch = globalThis.fetch || require('node-fetch');

const BASE_URL = 'https://api.finmindtrade.com/api/v4/data';
const TOKEN = (process.env.FINMIND_TOKENS || process.env.FINMIND_TOKEN || '').split(',')[0].trim();

async function fetchFinMind(dataset, data_id, start_date) {
    let url = `${BASE_URL}?dataset=${dataset}&start_date=${start_date}`;
    if (data_id) url += `&data_id=${data_id}`;
    if (TOKEN) url += `&token=${TOKEN}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json.data || [];
}

async function restoreTAIEX() {
    const client = await pool.connect();
    try {
        const start_date = '2025-09-01'; // 6 months
        console.log(`Fetching TAIEX starting ${start_date}...`);
        
        await client.query(`
            INSERT INTO stocks (symbol, name, industry, market)
            VALUES ('TAIEX', '加權指數', '大盤', '上市')
            ON CONFLICT (symbol) DO NOTHING;
        `);
        
        console.log("Fetching TaiwanStockInfo for TAIEX...");
        let data = await fetchFinMind('TaiwanStockPrice', 'TAIEX', start_date);
        
        if (!data || data.length === 0) {
            console.log("TaiwanStockPrice for TAIEX empty. Trying TaiwanStockTotalReturnIndex...");
            // But wait, Return Index isn't Price index! Actually, FinMind documentation for TAIEX price index is TaiwanStockInfo = TAIEX
            // In repair_market_data.js it uses TaiwanStockTotalReturnIndex. But that's Total Return Index! Total Return Index is always higher than normal price index!
            // Actually, FinMind's TAIEX data in TaiwanStockPrice IS available under dataset=TaiwanStockPrice and data_id=TAIEX.
            data = await fetchFinMind('TaiwanStockPrice', 'TAIEX', start_date);
            if (!data || data.length === 0) {
                console.log("Trying TaiwanStockInfo 'TAIEX' under TaiwanStockInfo dataset to see if it exists...");
            }
        }
        
        console.log(`Fetched ${data.length} rows for TAIEX.`);
        
        for (const d of data) {
            const price = d.close || d.price;
            if (!price) continue;
            
            await client.query(`
                INSERT INTO daily_prices (symbol, trade_date, close_price, open_price, high_price, low_price, volume)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (symbol, trade_date) DO UPDATE SET
                    close_price = EXCLUDED.close_price,
                    open_price = EXCLUDED.open_price,
                    high_price = EXCLUDED.high_price,
                    low_price = EXCLUDED.low_price,
                    volume = EXCLUDED.volume
            `, [
                'TAIEX', d.date, price, d.open || price, d.max || price, d.min || price, d.Trading_Volume || 0
            ]);
        }
        console.log(`[Repair] Processed ${data.length} TAIEX rows.`);
        
        // Also fix the fm_total_margin to get recent data up to today
        console.log("Fetching TaiwanStockTotalMarginPurchaseShortSale...");
        const marginData = await fetchFinMind('TaiwanStockTotalMarginPurchaseShortSale', '', '2026-03-01');
        console.log(`Fetched ${marginData.length} margin rows.`);
        for (const d of marginData) {
            const row = {
                date: d.date, 
                name: d.name || d.Name || '',
                margin_purchase_buy: d.buy !== undefined ? d.buy : (d.MarginPurchaseBuy || 0),
                margin_purchase_sell: d.sell !== undefined ? d.sell : (d.MarginPurchaseSell || 0),
                margin_purchase_cash_repayment: d.Return !== undefined ? d.Return : (d.MarginPurchaseCashRepayment || 0),
                margin_purchase_yesterday_balance: d.YesBalance !== undefined ? d.YesBalance : (d.MarginPurchaseYesterdayBalance || 0),
                margin_purchase_today_balance: null,
                short_sale_buy: d.ShortSaleBuy || 0,
                short_sale_sell: d.ShortSaleSell || 0,
                short_sale_cash_repayment: d.ShortSaleCashRepayment || 0,
                short_sale_yesterday_balance: d.ShortSaleYesterdayBalance || 0,
                short_sale_today_balance: null
            };

            const val = d.TodayBalance !== undefined ? d.TodayBalance : d.MarginPurchaseTodayBalance;
            const name = (d.name || d.Name || '').toLowerCase();
            
            if (name.includes('margin')) row.margin_purchase_today_balance = val;
            else if (name.includes('short')) row.short_sale_today_balance = val;
            
            await client.query(`
                INSERT INTO fm_total_margin 
                (date, name, margin_purchase_buy, margin_purchase_sell, margin_purchase_cash_repayment, margin_purchase_yesterday_balance, margin_purchase_today_balance, short_sale_buy, short_sale_sell, short_sale_cash_repayment, short_sale_yesterday_balance, short_sale_today_balance)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT (date, name) DO UPDATE SET
                    margin_purchase_buy = EXCLUDED.margin_purchase_buy,
                    margin_purchase_sell = EXCLUDED.margin_purchase_sell,
                    margin_purchase_today_balance = EXCLUDED.margin_purchase_today_balance,
                    short_sale_today_balance = EXCLUDED.short_sale_today_balance
            `, [
                row.date, row.name, row.margin_purchase_buy, row.margin_purchase_sell, row.margin_purchase_cash_repayment, row.margin_purchase_yesterday_balance, row.margin_purchase_today_balance,
                row.short_sale_buy, row.short_sale_sell, row.short_sale_cash_repayment, row.short_sale_yesterday_balance, row.short_sale_today_balance
            ]);
        }
        
    } catch (err) {
        console.error('Repair failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

restoreTAIEX();
