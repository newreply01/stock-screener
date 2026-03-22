const { query } = require('../db');

/**
 * 偵測最新交易日
 * 台股每日收盤後更新，找到有超過 500 支股票資料的最新日期
 * @returns {Promise<Date|null>} 最新交易日，若無資料則回傳 null
 */
async function detectLatestTradingDate() {
    const dateDetectionSql = `
        SELECT trade_date, count(*) as count
        FROM daily_prices
        WHERE trade_date IN (
            SELECT DISTINCT trade_date FROM daily_prices ORDER BY trade_date DESC LIMIT 5
        )
        AND symbol ~ '^[0-9]{4}$'
        GROUP BY trade_date
        ORDER BY trade_date DESC
    `;
    const detectedDatesRes = await query(dateDetectionSql);

    if (detectedDatesRes.rows.length === 0) return null;

    // 優先找有超過 500 支標的的日期（確保是完整資料的交易日）
    for (const r of detectedDatesRes.rows) {
        if (parseInt(r.count) > 500) {
            return r.trade_date;
        }
    }

    // fallback: 回傳最近一筆
    return detectedDatesRes.rows[0].trade_date;
}

/**
 * 格式化日期為 YYYY-MM-DD 字串（解決時區偏移）
 * @param {Date|string|null} date
 * @returns {string|null}
 */
function formatLocalDate(date) {
    if (!date) return null;
    if (!(date instanceof Date)) {
        const d = new Date(date);
        if (isNaN(d.getTime())) return String(date);
        date = d;
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

module.exports = { detectLatestTradingDate, formatLocalDate };
