const { Pool } = require('pg');

const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5533 });

async function check() {
  try {
    console.log('--- fm_sync_progress Summary ---');
    const res = await pool.query("SELECT dataset, MAX(last_sync_date) as latest, COUNT(*) FROM fm_sync_progress GROUP BY dataset ORDER BY latest DESC");
    res.rows.forEach(r => {
      console.log(`[${r.dataset}] Latest: ${r.latest?.toLocaleString('zh-TW')} | Count: ${r.count}`);
    });

    console.log('\n--- system_ingestion_daily_stats Summary (Last 5 days) ---');
    const stats = await pool.query("SELECT date, service_name, row_count FROM system_ingestion_daily_stats ORDER BY date DESC, service_name LIMIT 20");
    stats.rows.forEach(r => {
      console.log(`[${r.date.toLocaleDateString('en-CA')}] ${r.service_name}: ${r.row_count} rows`);
    });

  } catch (e) {
    console.log('Error:', e.message);
  }
  await pool.end();
}
check();
