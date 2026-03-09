/**
 * Batch Health Check Scoring Script
 * 
 * Pre-calculates health check scores for ALL stocks and stores them
 * in the stock_health_scores table for fast API retrieval.
 * 
 * Can be run standalone or triggered after daily data sync.
 */

const { query } = require('../db');

async function createTable() {
    await query(`
        CREATE TABLE IF NOT EXISTS stock_health_scores (
            id SERIAL PRIMARY KEY,
            symbol VARCHAR(20) NOT NULL,
            name VARCHAR(100),
            industry VARCHAR(100),
            market VARCHAR(10),
            close_price DECIMAL(12,2),
            change_percent DECIMAL(8,4),
            overall_score INTEGER DEFAULT 0,
            grade VARCHAR(20),
            grade_color VARCHAR(20),
            profit_score INTEGER DEFAULT 0,
            growth_score INTEGER DEFAULT 0,
            safety_score INTEGER DEFAULT 0,
            value_score INTEGER DEFAULT 0,
            dividend_score INTEGER DEFAULT 0,
            chip_score INTEGER DEFAULT 0,
            pe DECIMAL(10,2),
            pb DECIMAL(10,2),
            dividend_yield DECIMAL(8,4),
            roe DECIMAL(8,2),
            gross_margin DECIMAL(8,2),
            revenue_growth DECIMAL(10,2),
            eps_growth DECIMAL(10,2),
            avg_cash_dividend DECIMAL(8,2),
            inst_net_buy DECIMAL(12,2),
            calc_date DATE NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(symbol, calc_date)
        );
        CREATE INDEX IF NOT EXISTS idx_health_scores_date ON stock_health_scores(calc_date);
        CREATE INDEX IF NOT EXISTS idx_health_scores_overall ON stock_health_scores(overall_score DESC);
        CREATE INDEX IF NOT EXISTS idx_health_scores_symbol ON stock_health_scores(symbol);
    `);
    console.log('✅ stock_health_scores table ready');
}

async function calcAllScores() {
    console.time('⏱️ Total batch health check');

    // Get all active stocks
    const stocksRes = await query(`
        SELECT s.symbol, s.name, s.industry, s.market
        FROM stocks s
        WHERE s.symbol ~ '^[0-9]{4}$'
        ORDER BY s.symbol
    `);
    const allStocks = stocksRes.rows;
    console.log(`📊 Processing ${allStocks.length} stocks...`);

    // Get latest trade date - Format as string in DB to avoid TZ issues
    const dateRes = await query("SELECT TO_CHAR(MAX(trade_date), 'YYYY-MM-DD') as latest FROM daily_prices");
    let calcDate = dateRes.rows[0]?.latest;
    
    if (!calcDate) {
        calcDate = new Date().toISOString().split('T')[0];
    }

    // Batch fetch: fundamentals for all stocks
    const fundRes = await query(`
        SELECT DISTINCT ON (symbol) symbol, pe_ratio, pb_ratio, dividend_yield
        FROM fundamentals
        ORDER BY symbol, trade_date DESC
    `);
    const fundMap = {};
    fundRes.rows.forEach(r => { fundMap[r.symbol] = r; });

    // Batch fetch: latest prices
    const priceRes = await query(`
        SELECT DISTINCT ON (symbol) symbol, close_price, change_percent
        FROM daily_prices
        ORDER BY symbol, trade_date DESC
    `);
    const priceMap = {};
    priceRes.rows.forEach(r => { priceMap[r.symbol] = r; });

    // Batch fetch: monthly revenue (latest 13 months per stock) - FILTER IN SQL
    const revRes = await query(`
        SELECT symbol, revenue, revenue_year, revenue_month
        FROM (
            SELECT symbol, revenue, revenue_year, revenue_month,
                   ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY revenue_year DESC, revenue_month DESC) as rn
            FROM monthly_revenue
        ) t
        WHERE rn <= 13
    `);
    const revMap = {};
    revRes.rows.forEach(r => {
        if (!revMap[r.symbol]) revMap[r.symbol] = [];
        revMap[r.symbol].push(r);
    });

    // Batch fetch: EPS (latest 8 per stock) - FILTER IN SQL
    const epsRes = await query(`
        SELECT symbol, value, date
        FROM (
            SELECT symbol, value, date,
                   ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC) as rn
            FROM financial_statements
            WHERE type = 'EPS'
        ) t
        WHERE rn <= 8
    `);
    const epsMap = {};
    epsRes.rows.forEach(r => {
        if (!epsMap[r.symbol]) epsMap[r.symbol] = [];
        epsMap[r.symbol].push(r);
    });

    // Batch fetch: institutional (latest 10 per stock) - FILTER IN SQL
    const instRes = await query(`
        SELECT symbol, foreign_net, trust_net, total_net
        FROM (
            SELECT symbol, foreign_net, trust_net, total_net,
                   ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY trade_date DESC) as rn
            FROM institutional
        ) t
        WHERE rn <= 10
    `);
    const instMap = {};
    instRes.rows.forEach(r => {
        if (!instMap[r.symbol]) instMap[r.symbol] = [];
        instMap[r.symbol].push(r);
    });

    // Batch fetch: dividends (latest 5 per stock) - FILTER IN SQL
    const divRes = await query(`
        SELECT symbol, year, cash_dividend
        FROM (
            SELECT symbol, year, cash_dividend,
                   ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY year DESC) as rn
            FROM dividend_policy
        ) t
        WHERE rn <= 5
    `);
    const divMap = {};
    divRes.rows.forEach(r => {
        if (!divMap[r.symbol]) divMap[r.symbol] = [];
        divMap[r.symbol].push(r);
    });

    // Batch fetch: GrossProfit & Revenue from fm_financial_statements
    const grossRes = await query(`
        SELECT stock_id, value,
               ROW_NUMBER() OVER (PARTITION BY stock_id ORDER BY date DESC) as rn
        FROM fm_financial_statements
        WHERE type = 'GrossProfit'
    `);
    const grossMap = {};
    grossRes.rows.forEach(r => {
        if (r.rn == 1) grossMap[r.stock_id] = parseFloat(r.value) || 0;
    });

    const revStatRes = await query(`
        SELECT stock_id, value,
               ROW_NUMBER() OVER (PARTITION BY stock_id ORDER BY date DESC) as rn
        FROM fm_financial_statements
        WHERE type = 'Revenue'
    `);
    const revStatMap = {};
    revStatRes.rows.forEach(r => {
        if (r.rn == 1) revStatMap[r.stock_id] = parseFloat(r.value) || 0;
    });

    // Now calculate scores for each stock
    let processed = 0;
    let skipped = 0;
    const batchValues = [];

    const processedSymbols = new Set();
    for (const stock of allStocks) {
        const sym = stock.symbol;
        if (processedSymbols.has(sym)) {
            console.warn(`⚠️ Skipping duplicate symbol: ${sym}`);
            continue;
        }
        processedSymbols.add(sym);

        const fund = fundMap[sym] || {};
        const price = priceMap[sym] || {};
        const pe = parseFloat(fund.pe_ratio) || 0;
        const pb = parseFloat(fund.pb_ratio) || 0;
        const dy = parseFloat(fund.dividend_yield) || 0;
        const closePrice = parseFloat(price.close_price) || 0;
        const changePct = parseFloat(price.change_percent) || 0;

        if (!closePrice) { skipped++; continue; }

        // 1. Profitability
        const gp = grossMap[sym] || 0;
        const rv = revStatMap[sym] || 0;
        const grossMargin = (rv > 0 && gp > 0) ? (gp / rv * 100) : 0;
        const roe = (pe > 0 && pb > 0) ? (pb / pe * 100) : 0;
        let profitScore = 0;
        if (roe > 20) profitScore += 50; else if (roe > 10) profitScore += 35; else if (roe > 5) profitScore += 20; else profitScore += 5;
        if (grossMargin > 40) profitScore += 50; else if (grossMargin > 25) profitScore += 35; else if (grossMargin > 15) profitScore += 20; else profitScore += 5;

        // 2. Growth
        const revRows = revMap[sym] || [];
        let revenueGrowth = 0;
        if (revRows.length >= 13) {
            const curr = parseFloat(revRows[0].revenue);
            const prev = parseFloat(revRows[12].revenue);
            if (prev > 0) revenueGrowth = ((curr - prev) / prev) * 100;
        }
        const epsRows = epsMap[sym] || [];
        let epsGrowth = 0;
        if (epsRows.length >= 5) {
            const curr = parseFloat(epsRows[0].value);
            const prev = parseFloat(epsRows[4].value);
            if (prev > 0) epsGrowth = ((curr - prev) / prev) * 100;
        }
        let growthScore = 0;
        if (revenueGrowth > 20) growthScore += 50; else if (revenueGrowth > 10) growthScore += 35; else if (revenueGrowth > 0) growthScore += 20; else growthScore += 5;
        if (epsGrowth > 20) growthScore += 50; else if (epsGrowth > 10) growthScore += 35; else if (epsGrowth > 0) growthScore += 20; else growthScore += 5;

        // 3. Safety
        let safetyScore = 50;
        if (pb > 0 && pb < 1) safetyScore = 90; else if (pb < 1.5) safetyScore = 70; else if (pb < 3) safetyScore = 50; else safetyScore = 30;

        // 4. Value
        let valueScore = 50;
        if (pe > 0 && pe < 10) valueScore = 90; else if (pe < 15) valueScore = 75; else if (pe < 20) valueScore = 55; else if (pe < 30) valueScore = 35; else valueScore = 15;

        // 5. Dividend
        const divRows = divMap[sym] || [];
        const avgCashDiv = divRows.length > 0 ? divRows.reduce((s, d) => s + parseFloat(d.cash_dividend || 0), 0) / divRows.length : 0;
        let dividendScore = 0;
        if (dy > 6) dividendScore += 50; else if (dy > 4) dividendScore += 35; else if (dy > 2) dividendScore += 20; else dividendScore += 5;
        if (avgCashDiv > 3) dividendScore += 50; else if (avgCashDiv > 1.5) dividendScore += 35; else if (avgCashDiv > 0.5) dividendScore += 20; else dividendScore += 5;

        // 6. Chip
        const instRows = instMap[sym] || [];
        const totalBuy = instRows.reduce((s, r) => s + parseFloat(r.total_net || 0), 0);
        let chipScore = 50;
        if (totalBuy > 10000) chipScore = 90; else if (totalBuy > 5000) chipScore = 75; else if (totalBuy > 0) chipScore = 55; else if (totalBuy > -5000) chipScore = 35; else chipScore = 15;

        const overall = Math.round((profitScore + growthScore + safetyScore + valueScore + dividendScore + chipScore) / 6);
        let grade = '普通', gradeColor = 'yellow';
        if (overall >= 75) { grade = '優秀'; gradeColor = 'green'; }
        else if (overall >= 60) { grade = '良好'; gradeColor = 'blue'; }
        else if (overall >= 45) { grade = '普通'; gradeColor = 'yellow'; }
        else { grade = '待改善'; gradeColor = 'red'; }

        batchValues.push([
            sym, stock.name, stock.industry, stock.market,
            closePrice, changePct,
            overall, grade, gradeColor,
            profitScore, growthScore, safetyScore, valueScore, dividendScore, chipScore,
            pe, pb, dy, roe.toFixed(2), grossMargin.toFixed(2),
            revenueGrowth.toFixed(2), epsGrowth.toFixed(2),
            avgCashDiv.toFixed(2), (totalBuy / 1000).toFixed(2),
            calcDate
        ]);
        processed++;
    }

    // Batch insert (upsert)
    console.log(`📝 Inserting ${batchValues.length} scores (skipped ${skipped})...`);

    // Delete old entries for this date first
    await query('DELETE FROM stock_health_scores WHERE calc_date = $1', [calcDate]);

    // Insert in batches of 100
    const BATCH_SIZE = 100;
    for (let i = 0; i < batchValues.length; i += BATCH_SIZE) {
        const batch = batchValues.slice(i, i + BATCH_SIZE);
        const placeholders = batch.map((_, idx) => {
            const base = idx * 25;
            return `(${Array.from({ length: 25 }, (_, j) => `$${base + j + 1}`).join(',')})`;
        }).join(',');

        const flatValues = batch.flat();

        try {
            await query(`
                INSERT INTO stock_health_scores
                (symbol, name, industry, market, close_price, change_percent,
                 overall_score, grade, grade_color,
                 profit_score, growth_score, safety_score, value_score, dividend_score, chip_score,
                 pe, pb, dividend_yield, roe, gross_margin,
                 revenue_growth, eps_growth, avg_cash_dividend, inst_net_buy, calc_date)
                VALUES ${placeholders}
                ON CONFLICT (symbol, calc_date) DO UPDATE SET
                    name = EXCLUDED.name,
                    industry = EXCLUDED.industry,
                    market = EXCLUDED.market,
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
                    created_at = NOW()
            `, flatValues);
        } catch (err) {
            console.error(`❌ Error in batch ${i}-${i + BATCH_SIZE}:`, err.message);
            console.log('Symbols in this batch:', batch.map(b => b[0]).join(', '));
            throw err;
        }

        if ((i / BATCH_SIZE) % 5 === 0) {
            console.log(`  ...inserted ${Math.min(i + BATCH_SIZE, batchValues.length)}/${batchValues.length}`);
        }
    }

    console.timeEnd('⏱️ Total batch health check');
    console.log(`✅ Done! ${processed} stocks scored.`);
}

async function runAll() {
    await createTable();
    await calcAllScores();
}

// Run if called directly
if (require.main === module) {
    runAll().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}

module.exports = { runAll };
