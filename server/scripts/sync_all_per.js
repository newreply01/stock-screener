/**
 * Batch Sync PE/PB History Script
 * 
 * Fetches historical valuation data (PE, PB, Yield) for all active stocks
 * and stores them in the fm_stock_per table for the Valuation Model.
 */

const { pool } = require('../db');
const { syncStockPER } = require('../finmind_fetcher');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function runSync() {
    console.log("🚀 Starting batch sync for PE/PB history...");
    
    try {
        // Get all active stocks (4-digit symbols)
        const res = await pool.query(`
            SELECT symbol FROM stocks 
            WHERE symbol ~ '^[0-9]{4}$'
            ORDER BY symbol ASC
        `);
        const stocks = res.rows;
        console.log(`📊 Found ${stocks.length} stocks to sync.`);

        for (let i = 0; i < stocks.length; i++) {
            const sym = stocks[i].symbol;
            console.log(`[${i + 1}/${stocks.length}] Processing ${sym}...`);
            
            try {
                // Sync from 2020-01-01 by default
                await syncStockPER(sym);
            } catch (err) {
                console.error(`❌ Failed to sync ${sym}:`, err.message);
            }

            // FinMind rate limit consideration: 600 calls / hour per token
            // With a small delay to be safe
            if (i < stocks.length - 1) {
                await sleep(2000); 
            }
        }

        console.log("✅ Batch sync completed!");
    } catch (err) {
        console.error("❌ Fatal error during sync:", err);
    } finally {
        pool.end();
    }
}

runSync();
