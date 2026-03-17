const { generateAIReport } = require('../utils/ai_service');
const { pool } = require('../db');

async function batchGenerate() {
    console.log('🚀 Starting batch AI report generation (Smart Engine)...');
    
    try {
        // Fetch stocks that have health scores (indicating they are active/monitored)
        const stocksRes = await pool.query(`
            SELECT DISTINCT symbol 
            FROM stock_health_scores 
            ORDER BY symbol ASC
        `);
        
        const symbols = stocksRes.rows.map(r => r.symbol);
        console.log(`📊 Found ${symbols.length} stocks to process.`);

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < symbols.length; i++) {
            const symbol = symbols[i];
            process.stdout.write(`[\u23F3] Processing ${symbol} (${i + 1}/${symbols.length})... `);
            
            try {
                const result = await generateAIReport(symbol);
                if (result.success) {
                    successCount++;
                    console.log('✅ Done');
                } else {
                    failCount++;
                    console.log(`❌ Failed: ${result.error}`);
                }
            } catch (err) {
                failCount++;
                console.log(`❌ Error: ${err.message}`);
            }

            // Small delay to prevent DB connection saturation in tight loop
            if (i % 50 === 0 && i > 0) {
                console.log(`--- Progress: ${successCount} success, ${failCount} fails ---`);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        console.log('\n\u2728 Batch completion report:');
        console.log(`   Success: ${successCount}`);
        console.log(`   Failed:  ${failCount}`);
        console.log(`   Total:   ${symbols.length}`);

    } catch (err) {
        console.error('CRITICAL ERROR during batch process:', err);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

batchGenerate();
