const { pool } = require('../db');
const fs = require('fs');

const symbol = process.argv[2];
const reportPath = process.argv[3];

if (!symbol || !reportPath) {
    console.error('Usage: node inject_report.js <symbol> <path_to_markdown_file>');
    process.exit(1);
}

async function inject() {
    try {
        const content = fs.readFileSync(reportPath, 'utf8');
        
        // Simple sentiment score extraction from [Score]/100 or 評分: **[Score]
        const scoreMatch = content.match(/評分[^\d]*(\d+)/) || content.match(/Score[^\d]*(\d+)/);
        const sentimentScore = scoreMatch ? parseInt(scoreMatch[1]) : 50;

        await pool.query(
            `INSERT INTO ai_reports (symbol, content, sentiment_score, updated_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (symbol) 
             DO UPDATE SET content = EXCLUDED.content, sentiment_score = EXCLUDED.sentiment_score, updated_at = NOW()`,
            [symbol, content, sentimentScore]
        );

        console.log(`✅ Report for ${symbol} injected successfully with score ${sentimentScore}`);
    } catch (err) {
        console.error('❌ Injection failed:', err.message);
    } finally {
        await pool.end();
    }
}

inject();
