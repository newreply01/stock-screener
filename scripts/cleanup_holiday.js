const { pool } = require('../server/db');

async function cleanup() {
    console.log('--- 正在清理 2026-04-03 假日錯誤資料 ---');
    const targetDate = '2026-04-03';
    
    try {
        await pool.query('BEGIN');

        // 1. 刪除 AI 佇列
        const res1 = await pool.query('DELETE FROM ai_generation_queue WHERE report_date = $1', [targetDate]);
        console.log(`- 刪除 ai_generation_queue: ${res1.rowCount} 筆`);

        // 2. 刪除 價格資料
        const res2 = await pool.query('DELETE FROM daily_prices WHERE trade_date = $1', [targetDate]);
        console.log(`- 刪除 daily_prices: ${res2.rowCount} 筆`);

        // 3. 刪除 籌碼與基本面
        const res3 = await pool.query('DELETE FROM institutional WHERE trade_date = $1', [targetDate]);
        console.log(`- 刪除 institutional: ${res3.rowCount} 筆`);

        const res4 = await pool.query('DELETE FROM fundamentals WHERE trade_date = $1', [targetDate]);
        console.log(`- 刪除 fundamentals: ${res4.rowCount} 筆`);

        const res5 = await pool.query('DELETE FROM fm_margin_trading WHERE date = $1', [targetDate]);
        console.log(`- 刪除 fm_margin_trading: ${res5.rowCount} 筆`);

        const res6 = await pool.query('DELETE FROM fm_institutional WHERE date = $1', [targetDate]);
        console.log(`- 刪除 fm_institutional: ${res6.rowCount} 筆`);

        const res7 = await pool.query('DELETE FROM fm_stock_per WHERE date = $1', [targetDate]);
        console.log(`- 刪除 fm_stock_per: ${res7.rowCount} 筆`);

        await pool.query('COMMIT');
        console.log('--- 清理完成 ---');

    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('❌ 清理失敗:', err.message);
    } finally {
        await pool.end();
    }
}

cleanup();
