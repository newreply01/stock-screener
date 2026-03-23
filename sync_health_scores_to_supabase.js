const { Pool } = require('pg');
require('dotenv').config({ path: '/home/xg/stock-screener/.env' });

async function sync() {
  const localPool = new Pool({ user: 'postgres', host: 'localhost', database: 'stock_screener', password: 'postgres123', port: 5533 });
  const cloudPool = new Pool({ connectionString: process.env.SUPABASE_URL });

  try {
    const today = '2026-03-23';
    console.log(`Fetching local health scores for ${today}...`);
    // 使用 DISTINCT ON 確保每個 symbol 只有一筆，避免 batch insert 衝突
    const res = await localPool.query("SELECT DISTINCT ON (symbol) * FROM stock_health_scores WHERE calc_date = $1 ORDER BY symbol, created_at DESC", [today]);
    console.log(`Found ${res.rows.length} unique records for sync.`);

    if (res.rows.length > 0) {
      console.log('Syncing to Supabase...');
      for (let i = 0; i < res.rows.length; i += 100) {
          const batch = res.rows.slice(i, i + 100);
          const placeholders = batch.map((_, idx) => {
              const base = idx * 27;
              return `(${Array.from({ length: 27 }, (_, j) => `$${base + j + 1}`).join(',')})`;
          }).join(',');
          
          const flatValues = batch.map(r => [
              r.symbol, r.name, r.industry, r.market, r.close_price, r.change_percent,
              r.overall_score, r.grade, r.grade_color,
              r.profit_score, r.growth_score, r.safety_score, r.value_score, r.dividend_score, r.chip_score,
              r.pe, r.pb, r.dividend_yield, r.roe, r.gross_margin,
              r.revenue_growth, r.eps_growth, r.avg_cash_dividend, r.inst_net_buy,
              r.smart_score, r.smart_rating, r.calc_date
          ]).flat();

          await cloudPool.query(`
              INSERT INTO stock_health_scores 
              (symbol, name, industry, market, close_price, change_percent,
               overall_score, grade, grade_color,
               profit_score, growth_score, safety_score, value_score, dividend_score, chip_score,
               pe, pb, dividend_yield, roe, gross_margin,
               revenue_growth, eps_growth, avg_cash_dividend, inst_net_buy, 
               smart_score, smart_rating, calc_date)
              VALUES ${placeholders}
              ON CONFLICT (symbol, calc_date) DO UPDATE SET
                close_price = EXCLUDED.close_price,
                change_percent = EXCLUDED.change_percent,
                overall_score = EXCLUDED.overall_score,
                grade = EXCLUDED.grade,
                grade_color = EXCLUDED.grade_color,
                profit_score = EXCLUDED.profit_score,
                growth_score = EXCLUDED.growth_score,
                safety_score = EXCLUDED.safety_score,
                value_score = EXCLUDED.value_score,
                dividend_score = EXCLUDED.dividend_score,
                chip_score = EXCLUDED.chip_score,
                pe = EXCLUDED.pe,
                pb = EXCLUDED.pb,
                dividend_yield = EXCLUDED.dividend_yield,
                roe = EXCLUDED.roe,
                gross_margin = EXCLUDED.gross_margin,
                revenue_growth = EXCLUDED.revenue_growth,
                eps_growth = EXCLUDED.eps_growth,
                avg_cash_dividend = EXCLUDED.avg_cash_dividend,
                inst_net_buy = EXCLUDED.inst_net_buy,
                smart_score = EXCLUDED.smart_score,
                smart_rating = EXCLUDED.smart_rating
          `, flatValues);
          console.log(`  Synced ${Math.min(i + 100, res.rows.length)}/${res.rows.length}`);
      }
    }
    console.log('✅ Sync complete!');
  } catch (e) {
    console.log('Error:', e.message);
  } finally {
    await localPool.end();
    await cloudPool.end();
  }
}
sync();
