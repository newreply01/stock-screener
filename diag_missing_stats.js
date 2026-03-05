const { pool } = require('./server/db');

async function checkMissingStats() {
    const queries = [
        { name: '當沖 (fm_day_trading)', sql: "SELECT date::text, COUNT(*) FROM fm_day_trading WHERE date >= CURRENT_DATE - INTERVAL '3 days' GROUP BY date ORDER BY date DESC" },
        { name: '全市場法人 (fm_total_institutional)', sql: "SELECT date::text, COUNT(*) FROM fm_total_institutional WHERE date >= CURRENT_DATE - INTERVAL '3 days' GROUP BY date ORDER BY date DESC" },
        { name: '全市場融資 (fm_total_margin)', sql: "SELECT date::text, COUNT(*) FROM fm_total_margin WHERE date >= CURRENT_DATE - INTERVAL '3 days' GROUP BY date ORDER BY date DESC" },
        { name: '期貨 (fm_futures_daily)', sql: "SELECT date::text, COUNT(*) FROM fm_futures_daily WHERE date >= CURRENT_DATE - INTERVAL '3 days' GROUP BY date ORDER BY date DESC" },
        { name: '選擇權 (fm_option_daily)', sql: "SELECT date::text, COUNT(*) FROM fm_option_daily WHERE date >= CURRENT_DATE - INTERVAL '3 days' GROUP BY date ORDER BY date DESC" },
        { name: '月營收 (monthly_revenue)', sql: "SELECT date::text, COUNT(*) FROM monthly_revenue WHERE date >= CURRENT_DATE - INTERVAL '30 days' GROUP BY date ORDER BY date DESC LIMIT 1" },
        { name: '健診分數 (stock_health_scores)', sql: "SELECT created_at::date::text as date, COUNT(*) FROM stock_health_scores WHERE created_at >= CURRENT_DATE - INTERVAL '3 days' GROUP BY date ORDER BY date DESC" },
        { name: '即時行情 (realtime_ticks)', sql: "SELECT trade_time::date::text as date, COUNT(*) FROM realtime_ticks WHERE trade_time >= CURRENT_DATE - INTERVAL '3 days' GROUP BY date ORDER BY date DESC" }
    ];

    console.log('--- 遺漏報表之資料量診斷 ---');
    for (const q of queries) {
        try {
            const res = await pool.query(q.sql);
            console.log(`\n[${q.name}]`);
            if (res.rows.length === 0) {
                console.log('  今日無資料');
            } else {
                res.rows.forEach(r => console.log(`  ${r.date || r.trade_time_str}: ${r.count} 筆`));
            }
        } catch (err) {
            console.error(`  查詢 ${q.name} 失敗: ${err.message}`);
        }
    }
    process.exit(0);
}

checkMissingStats();
