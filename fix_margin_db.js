const { pool } = require('./server/db');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require('dotenv').config({ path: '.env' });

async function fixMargin() {
    const client = await pool.connect();
    try {
        console.log("Fetching FinMind margin data...");
        // Get last 60 days
        const startRaw = new Date();
        startRaw.setDate(startRaw.getDate() - 90);
        const startDate = startRaw.toISOString().split('T')[0];
        const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockTotalMarginPurchaseShortSale&start_date=${startDate}&token=${process.env.FINMIND_TOKEN || ''}`;

        const res = await fetch(url);
        const json = await res.json();

        if (json.status !== 200) {
            console.error("API failed:", json.msg);
            return;
        }

        const data = json.data;
        console.log(`Fetched ${data.length} records.`);

        // Clear existing empty records
        await client.query("DELETE FROM fm_total_margin WHERE margin_purchase_today_balance IS NULL");

        // Map and Insert
        for (const d of data) {
            const date = d.date;
            const name = d.name || d.Name || '';
            const mpBuy = d.buy !== undefined ? d.buy : d.MarginPurchaseBuy;
            const mpSell = d.sell !== undefined ? d.sell : d.MarginPurchaseSell;
            const mpCashRepay = d.Return !== undefined ? d.Return : d.MarginPurchaseCashRepayment;
            const mpYesBal = d.YesBalance !== undefined ? d.YesBalance : d.MarginPurchaseYesterdayBalance;
            const mpTodayBal = d.TodayBalance !== undefined ? d.TodayBalance : d.MarginPurchaseTodayBalance;

            // Upsert
            await client.query(`
                INSERT INTO fm_total_margin (
                    date, name, margin_purchase_buy, margin_purchase_sell, margin_purchase_cash_repayment,
                    margin_purchase_yesterday_balance, margin_purchase_today_balance
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (date, name) DO UPDATE SET
                    margin_purchase_buy = EXCLUDED.margin_purchase_buy,
                    margin_purchase_sell = EXCLUDED.margin_purchase_sell,
                    margin_purchase_cash_repayment = EXCLUDED.margin_purchase_cash_repayment,
                    margin_purchase_yesterday_balance = EXCLUDED.margin_purchase_yesterday_balance,
                    margin_purchase_today_balance = EXCLUDED.margin_purchase_today_balance
            `, [date, name, mpBuy, mpSell, mpCashRepay, mpYesBal, mpTodayBal]);
        }
        console.log("Margin data fixed.");

        // Also let's check TAIEX
        const taiexRes = await client.query("SELECT count(*) FROM fm_total_return_index WHERE stock_id='TAIEX'");
        console.log(`TAIEX records in fm_total_return_index: ${taiexRes.rows[0].count}`);

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        process.exit(0);
    }
}
fixMargin();
