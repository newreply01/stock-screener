const { pool } = require('../db');
const fs = require('fs');
const { calculateScores } = require('../utils/factor_scoring_service');

async function run() {
    const symbol = '2330';
    try {
        const scores = await calculateScores(symbol);
        const stockRes = await pool.query(`SELECT name, industry FROM stocks WHERE symbol = $1`, [symbol]);
        const info = stockRes.rows[0];

        const priceRes = await pool.query(`SELECT * FROM daily_prices WHERE symbol = $1 ORDER BY trade_date DESC LIMIT 5`, [symbol]);
        const prices = priceRes.rows;

        const fundRes = await pool.query(`SELECT * FROM fundamentals WHERE symbol = $1 ORDER BY trade_date DESC LIMIT 1`, [symbol]);
        const fundamentals = fundRes.rows[0];

        const instRes = await pool.query(`SELECT trade_date, foreign_net, trust_net FROM institutional_2025 WHERE symbol = $1 ORDER BY trade_date DESC LIMIT 5`, [symbol]);
        const institutional = instRes.rows;

        const revRes = await pool.query(`SELECT * FROM monthly_revenue WHERE symbol = $1 ORDER BY revenue_year DESC, revenue_month DESC LIMIT 3`, [symbol]);
        const revenue = revRes.rows;

        const newsRes = await pool.query(`SELECT title, summary, publish_at FROM news WHERE (title ILIKE $1 OR summary ILIKE $1) ORDER BY publish_at DESC LIMIT 5`, [`%${symbol}%`]);
        const news = newsRes.rows;

        const context = { symbol, info, scores, prices, fundamentals, institutional, revenue, news };
        fs.writeFileSync(__dirname + '/context_2330_v3.json', JSON.stringify(context, null, 2));
        console.log('✅ Context for 2330 V3 saved');
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
