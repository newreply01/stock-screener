const { Pool } = require('pg');
require('dotenv').config({ path: '/home/xg/stock-screener/.env' });

async function check() {
  const connectionString = process.env.SUPABASE_URL;
  const pool = new Pool({ connectionString });
  try {
    const instDates = await pool.query("SELECT trade_date, COUNT(*) FROM institutional GROUP BY trade_date ORDER BY trade_date DESC LIMIT 5");
    const totalInst = await pool.query("SELECT COUNT(*) FROM fm_total_institutional WHERE date >= CURRENT_DATE - INTERVAL '30 days'");
    const totalMargin = await pool.query("SELECT COUNT(*) FROM fm_total_margin WHERE date >= CURRENT_DATE - INTERVAL '30 days'");
    
    console.log('--- Supabase Comprehensive Institutional Check ---');
    console.log('\n[Individual Institutional Ranking Dates]');
    instDates.rows.forEach(r => {
      console.log(`- ${r.trade_date.toLocaleDateString('en-CA')}: ${r.count} records`);
    });
    
    console.log(`\n[Market Total Counts (Last 30 Days)]`);
    console.log(`- fm_total_institutional: ${totalInst.rows[0].count} records`);
    console.log(`- fm_total_margin: ${totalMargin.rows[0].count} records`);

  } catch (e) {
    console.log('Error:', e.message);
  }
  await pool.end();
}
check();
