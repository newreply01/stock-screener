const { query, end } = require('./db');

async function reset() {
    try {
        console.log('🗑️正在清空資料庫 (TRUNCATE)...');
        await query('TRUNCATE TABLE daily_prices, fundamentals, institutional RESTART IDENTITY CASCADE;');
        console.log('✅ 資料庫已清空。');
    } catch (err) {
        console.error('❌ 清空失敗:', err);
    } finally {
        end();
    }
}

reset();
