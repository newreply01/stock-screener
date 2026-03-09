const { pool } = require('../db');
const fetch = globalThis.fetch || require('node-fetch');

const BASE_URL = 'https://api.finmindtrade.com/api/v4/data';
const TOKEN = (process.env.FINMIND_TOKENS || process.env.FINMIND_TOKEN || '').split(',')[0].trim();

const GAPS = [
    { start: '2025-12-20', end: '2026-01-05' },
    { start: '2026-02-01', end: '2026-03-08' }
];

async function fetchFinMind(dataset, data_id, start_date) {
    let url = `${BASE_URL}?dataset=${dataset}&start_date=${start_date}`;
    if (data_id) url += `&data_id=${data_id}`;
    if (TOKEN) url += `&token=${TOKEN}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json.data || [];
}

async function repairMargin(client, start_date) {
    const dataset = 'TaiwanStockTotalMarginPurchaseShortSale';
    console.log(`[Repair] Fetching ${dataset} starting ${start_date}...`);
    const data = await fetchTaiwanStockTotalMarginPurchaseShortSale(start_date); // Mocking the fetch call structure in sync script
    
    // Using a simplified version of the logic from finmind_full_sync.js
    const mapped = data.map(d => {
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
        
        if (name.includes('margin')) {
            row.margin_purchase_today_balance = val;
        } else if (name.includes('short')) {
            row.short_sale_today_balance = val;
        }
        return row;
    });

    for (const r of mapped) {
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
            r.date, r.name, r.margin_purchase_buy, r.margin_purchase_sell, r.margin_purchase_cash_repayment, r.margin_purchase_yesterday_balance, r.margin_purchase_today_balance,
            r.short_sale_buy, r.short_sale_sell, r.short_sale_cash_repayment, r.short_sale_yesterday_balance, r.short_sale_today_balance
        ]);
    }
    console.log(`[Repair] Processed ${mapped.length} margin rows.`);
}

async function repairPrices(client, start_date) {
    const dataset = 'TaiwanStockTotalReturnIndex';
    console.log(`[Repair] Fetching ${dataset} for TAIEX starting ${start_date}...`);
    const data = await fetchFinMind(dataset, 'TAIEX', start_date);
    
    for (const d of data) {
        await client.query(`
            INSERT INTO daily_prices (symbol, trade_date, close_price)
            VALUES ($1, $2, $3)
            ON CONFLICT (symbol, trade_date) DO UPDATE SET
                close_price = EXCLUDED.close_price
        `, [
            'TAIEX', d.date, d.price
        ]);
    }
    console.log(`[Repair] Processed ${data.length} price rows.`);
}

async function fetchTaiwanStockTotalMarginPurchaseShortSale(start_date) {
    return await fetchFinMind('TaiwanStockTotalMarginPurchaseShortSale', '', start_date);
}

async function runRepair() {
    const client = await pool.connect();
    try {
        console.log('Starting Targeted Data Repair...');
        for (const gap of GAPS) {
            console.log(`\n>>> Repairing Gap: ${gap.start} to ${gap.end}`);
            await repairMargin(client, gap.start);
            await repairPrices(client, gap.start);
        }
        console.log('\nRepair Complete!');
    } catch (err) {
        console.error('Repair failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

runRepair();
