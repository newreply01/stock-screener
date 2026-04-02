const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { generateAIReport } = require('./server/utils/ai_service');
const { pool } = require('./server/db');

async function testOne() {
    const symbol = '6770';
    const reportDate = '2026-03-30';
    console.log(`[Test] Starting analysis for ${symbol} on ${reportDate}...`);
    
    try {
        const result = await generateAIReport(symbol);
        if (result.success) {
            console.log(`[Test] Success! Content length: ${result.content.length}`);
            console.log(`[Test] Sentiment Score: ${result.sentimentScore}`);
            
            // Manually save it for the test
            await pool.query(`
                INSERT INTO ai_reports (symbol, report_date, content, sentiment_score, updated_at)
                VALUES ($1, $2, $3, $4, NOW())
                ON CONFLICT (symbol, report_date) DO UPDATE SET 
                    content = EXCLUDED.content,
                    sentiment_score = EXCLUDED.sentiment_score,
                    updated_at = NOW();
            `, [symbol, reportDate, result.content, result.sentimentScore]);
            
            console.log(`[Test] Saved to DB. Please check the monitor.`);
        } else {
            console.error(`[Test] Failed: ${result.error}`);
        }
    } catch (err) {
        console.error(`[Test] Exception:`, err);
    } finally {
        process.exit(0);
    }
}

testOne();
