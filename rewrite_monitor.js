const fs = require('fs');
const filePath = '/home/xg/stock-screener/server/routes/monitor.js';
let code = fs.readFileSync(filePath, 'utf8');

// Replace the ingestion-stats route
const newRoute = `
router.get('/ingestion-stats', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const { updateDailyStats } = require('../utils/statsAggregator');
        
        // 1. 取得歷史資料 (從匯總表)
        const historyRes = await pool.query(\`
            SELECT TO_CHAR(trade_date, 'YYYY-MM-DD') as date,
                   price_count, inst_count, margin_count, news_count,
                   realtime_count, stats_count, health_count
            FROM system_ingestion_daily_stats
            WHERE trade_date >= CURRENT_DATE - INTERVAL '\${days - 1} days'
                  AND trade_date < CURRENT_DATE
            ORDER BY trade_date ASC
        \`);

        const statsMap = {};
        for (let i = days - 1; i >= 1; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const dateStr = \`\${yyyy}-\${mm}-\${dd}\`;
            
            statsMap[dateStr] = {
                date: dateStr,
                price_count: 0, inst_count: 0, margin_count: 0, 
                news_count: 0, realtime_count: 0, stats_count: 0, health_count: 0
            };
        }

        historyRes.rows.forEach(r => {
            if(statsMap[r.date]) {
                ['price_count', 'inst_count', 'margin_count', 'news_count', 'realtime_count', 'stats_count', 'health_count'].forEach(field => {
                    statsMap[r.date][field] = parseInt(r[field] || 0, 10);
                });
            }
        });

        const statsArray = Object.values(statsMap);

        // 2. 即時計算「今日」資料
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const todayStr = \`\${yyyy}-\${mm}-\${dd}\`;

        // 呼叫我們實作的 statsAggregator 即時算今日 (Promise.all 優化)
        const todayStats = await updateDailyStats(todayStr);
        statsArray.push(todayStats);

        res.json({
            success: true,
            data: statsArray
        });

    } catch (err) {
        console.error('Monitor ingestion stats error:', err);
        res.status(500).json({ success: false, error: 'Failed to retrieve ingestion stats' });
    }
});
`;

code = code.replace(/router\.get\('\/ingestion-stats', async \(req, res\) => \{[\s\S]*\}\);\n\nmodule\.exports = router;/g, newRoute.trim() + '\n\nmodule.exports = router;');

fs.writeFileSync(filePath, code);
console.log('Done refactoring monitor.js');
