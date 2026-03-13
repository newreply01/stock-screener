/**
 * Timezone Utility for Taiwan (Asia/Taipei)
 * Ensures consistent date handling across different server environments (e.g., Vercel UTC).
 */

const TZ = 'Asia/Taipei';

/**
 * Returns a Date object representing the current time in Taiwan.
 * @returns {Date}
 */
function getTaiwanDate() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
}

/**
 * Returns a YYYY-MM-DD string for the current date in Taiwan.
 * @returns {string}
 */
function getTaiwanDateString() {
    const d = getTaiwanDate();
    return d.toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD
}

/**
 * Returns a formatted string for localized display.
 * @param {Date|string|number} date 
 * @returns {string}
 */
function formatTaiwanTime(date = new Date()) {
    return new Date(date).toLocaleString('zh-TW', { timeZone: TZ });
}

module.exports = {
    getTaiwanDate,
    getTaiwanDateString,
    formatTaiwanTime,
    TZ
};
