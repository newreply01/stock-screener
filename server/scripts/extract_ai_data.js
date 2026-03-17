const { pool } = require('../db');

async function extract() {
    const symbols = ['2330', '2317', '2382'];
    const results = {};

    try {
        // 1. Get Template
        const templateRes = await pool.query("SELECT content FROM ai_prompt_templates WHERE name = 'stock_analysis_report' AND is_active = true LIMIT 1");
        results.template = templateRes.rows[0]?.content;

        // 2. Get Stock Contexts
        for (const symbol of symbols) {
            results[symbol] = {};
            
            const stockRes = await pool.query(`SELECT name, industry FROM stocks WHERE symbol = $1`, [symbol]);
            results[symbol].info = stockRes.rows[0];

            const priceRes = await pool.query(`
                SELECT p.*, i.rsi_14, i.macd_hist, i.ma_5, i.ma_10, i.ma_20, i.ma_60, i.patterns
                FROM daily_prices p
                LEFT JOIN indicators i ON p.symbol = i.symbol AND p.trade_date = i.trade_date
                WHERE p.symbol = $1
                ORDER BY p.trade_date DESC LIMIT 5`, [symbol]);
            results[symbol].prices = priceRes.rows;

            const fundRes = await pool.query(`SELECT * FROM fundamentals WHERE symbol = $1 ORDER BY trade_date DESC LIMIT 1`, [symbol]);
            results[symbol].fundamentals = fundRes.rows[0];

            const instRes = await pool.query(`SELECT * FROM institutional_2025 WHERE symbol = $1 ORDER BY trade_date DESC LIMIT 10`, [symbol]);
            results[symbol].institutional = instRes.rows;

            const revRes = await pool.query(`SELECT * FROM monthly_revenue WHERE symbol = $1 ORDER BY revenue_year DESC, revenue_month DESC LIMIT 3`, [symbol]);
            results[symbol].revenue = revRes.rows;

            const newsRes = await pool.query(`SELECT title, summary, publish_at FROM news WHERE (title ILIKE $1 OR summary ILIKE $1) ORDER BY publish_at DESC LIMIT 10`, [`%${symbol}%`]);
            results[symbol].news = newsRes.rows;
        }

        console.log(JSON.stringify(results, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

extract();
