const { generateAIReport } = require('./server/utils/ai_service');
const { query } = require('./server/db');

async function test20b() {
    const symbol = '3481';
    const model = 'gpt-oss:20b';
    console.log(`Cross-validation for ${symbol} using ${model}...`);
    
    try {
        const result = await generateAIReport(symbol, model);
        if (result.success) {
            console.log("--- RESULT START ---");
            console.log(result.content);
            console.log("--- RESULT END ---");
            
            // Save to DB
            await query(
                `INSERT INTO ai_reports (symbol, report_date, content, sentiment_score, model_name)
                 VALUES ($1, '2026-03-30', $2, $3, $4)
                 ON CONFLICT (symbol, report_date) DO UPDATE 
                 SET content = EXCLUDED.content, sentiment_score = EXCLUDED.sentiment_score, model_name = EXCLUDED.model_name`,
                [symbol, result.content, result.sentimentScore, model]
            );
            console.log("Database updated.");
        } else {
            console.error("Generation failed:", result.error);
        }
    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        process.exit();
    }
}

test20b();
