const { pool } = require('../db');

/**
 * Indicator Efficacy & Attribution Analysis
 * 
 * This script calculates the "Alpha" and "Win Rate" of various health score dimensions
 * to identify which indicators are the most reliable predictors of future returns.
 */

async function analyzeEfficacy() {
    console.log('--- Starting Indicator Efficacy Attribution Analysis ---');
    try {
        // 1. Get available calc_dates
        const dateRes = await pool.query(`
            SELECT DISTINCT calc_date 
            FROM stock_health_scores 
            ORDER BY calc_date DESC 
            LIMIT 30
        `);
        const dates = dateRes.rows.map(r => r.calc_date.toISOString().split('T')[0]);
        
        if (dates.length < 2) {
            console.log('❌ Not enough historical data for efficacious analysis.');
            return;
        }

        const dimensions = [
            'profit_score', 'growth_score', 'safety_score', 
            'value_score', 'dividend_score', 'chip_score', 'overall_score'
        ];

        const efficacyResults = {};
        dimensions.forEach(d => { efficacyResults[d] = { high: [], low: [], all: [] }; });

        // 2. Iterate through date pairs
        for (let i = 0; i < dates.length - 1; i++) {
            const t0 = dates[i+1]; // Date scores were calculated
            const t1 = dates[i];   // Date performance is checked
            
            for (const dim of dimensions) {
                // High Score Group (>75) vs Low Score Group (<40)
                const query = `
                    WITH prev AS (
                        SELECT symbol, close_price as p0, ${dim} as score
                        FROM stock_health_scores
                        WHERE calc_date = $1 AND ${dim} IS NOT NULL
                    ),
                    curr AS (
                        SELECT symbol, close_price as p1
                        FROM stock_health_scores
                        WHERE calc_date = $2
                    ),
                    stats AS (
                        SELECT 
                            p.symbol,
                            p.score,
                            ((c.p1 - p.p0) / p.p0 * 100) as ret
                        FROM prev p
                        JOIN curr c ON p.symbol = c.symbol
                        WHERE p.p0 > 0
                    )
                    SELECT 
                        'High' as group,
                        COUNT(*) as count,
                        AVG(ret) as avg_ret,
                        COUNT(CASE WHEN ret > 0 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) as win_rate
                    FROM stats WHERE score >= 75
                    UNION ALL
                    SELECT 
                        'Low' as group,
                        COUNT(*) as count,
                        AVG(ret) as avg_ret,
                        COUNT(CASE WHEN ret > 0 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) as win_rate
                    FROM stats WHERE score <= 40
                `;
                
                const res = await pool.query(query, [t0, t1]);
                res.rows.forEach(row => {
                    if (row.group === 'High') efficacyResults[dim].high.push(row);
                    else efficacyResults[dim].low.push(row);
                });
            }
        }

        // 3. Summarize Findings
        console.log('\n==========================================================');
        console.log('📊 INDICATOR EFFICACY RANKING (Win Rate of High-Score Group)');
        console.log('==========================================================');
        
        const finalRanking = dimensions.map(dim => {
            const highStats = efficacyResults[dim].high;
            const avgWinRate = highStats.reduce((s, r) => s + parseFloat(r.win_rate || 0), 0) / highStats.length;
            const avgRet = highStats.reduce((s, r) => s + parseFloat(r.avg_ret || 0), 0) / highStats.length;
            
            const lowStats = efficacyResults[dim].low;
            const lowWinRate = lowStats.reduce((s, r) => s + parseFloat(r.win_rate || 0), 0) / lowStats.length;
            
            return {
                dimension: dim,
                winRate: avgWinRate,
                avgReturn: avgRet,
                predictivePower: avgWinRate - lowWinRate // Edge over low-score group
            };
        }).sort((a, b) => b.winRate - a.winRate);

        finalRanking.forEach((r, idx) => {
            const emoji = idx === 0 ? '🏆' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '📈';
            console.log(`${emoji} ${r.dimension.padEnd(15)} | Win Rate: ${r.winRate.toFixed(2)}% | Avg Ret: ${r.avgReturn.toFixed(2)}% | Predictivity: ${r.predictivePower.toFixed(2)}%`);
        });

        console.log('\n💡 Interpretations:');
        console.log('- Win Rate: Frequency of positive returns in stocks with scores >= 75.');
        console.log('- Predictivity: Difference in Win Rate between High-Score and Low-Score groups.');
        console.log('----------------------------------------------------------');

    } catch (e) {
        console.error('❌ Efficacy Analysis failed:', e);
    } finally {
        await pool.end();
    }
}

analyzeEfficacy();
