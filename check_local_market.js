const { Pool } = require('pg');

const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5533 });

async function check() {
  try {
    const focusRes = await pool.query("SELECT COUNT(*) FROM market_focus_daily");
    console.log(`Local market_focus_daily count: ${focusRes.rows[0].count}`);
    
    const indexRes = await pool.query("SELECT COUNT(*) FROM daily_prices WHERE symbol = 'TAIEX' AND trade_date >= CURRENT_DATE - INTERVAL '30 days'");
    console.log(`Local TAIEX records (Last 30 days): ${indexRes.rows[0].count}`);
    
    if (indexRes.rows[0].count > 0) {
        const lastIndex = await pool.query("SELECT trade_date, close_price FROM daily_prices WHERE symbol = 'TAIEX' ORDER BY trade_date DESC LIMIT 5");
        console.log('\nLast 5 TAIEX dates:');
        lastIndex.rows.forEach(r => console.log(`- ${r.trade_date.toLocaleDateString('en-CA')}: ${r.close_price}`));
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
  await pool.end();
}
check();
