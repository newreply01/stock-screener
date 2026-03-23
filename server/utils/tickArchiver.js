const { query } = require('../db');

/**
 * 負責 Tick 資料的每日歸檔與清理
 */
const TickArchiver = {
    /**
     * 將當日 Ticks 搬移至歷史表並清空
     */
    async archiveAndTruncate() {
        // 0. 檢查今天是否為交易日
        const isTrading = await this.isTradingDay(new Date());
        if (!isTrading) {
            console.log('[TickArchiver] 今日休市，跳過歸檔任務（保留前一交易日資料供查看）。');
            return;
        }

        console.log('[TickArchiver] 今日預計開盤，開始執行歸檔任務 (Move & Truncate)...');
        try {
            // 1. 確保下個月的分區存在 (預建)
            await this.ensureMonthlyPartition();

            // 2. 搬移資料到歷史表
            console.log('[TickArchiver] 正在將資料搬移至 realtime_ticks_history...');
            const moveRes = await query(`
                INSERT INTO realtime_ticks_history 
                SELECT * FROM realtime_ticks 
                ON CONFLICT (symbol, trade_time) DO NOTHING
            `);
            console.log(`[TickArchiver] 歸檔完成，共搬移 ${moveRes.rowCount} 筆資料。`);

            // 3. 清空當日表
            console.log('[TickArchiver] 正在清空當日表 realtime_ticks...');
            await query(`TRUNCATE TABLE realtime_ticks`);
            console.log('[TickArchiver] 清空完成。');

        } catch (err) {
            console.error('[TickArchiver] 歸檔失敗:', err.message);
            throw err;
        }
    },

    /**
     * 確保歷史表的月份分區存在
     */
    async ensureMonthlyPartition(monthsAhead = 1) {
        const today = new Date();
        for (let i = 0; i <= monthsAhead; i++) {
            const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            
            const partitionName = `realtime_ticks_history_${year}_${month}`;
            const fromStr = `${year}-${month}-01`;
            
            const nextMonthDate = new Date(year, date.getMonth() + 1, 1);
            const nextYear = nextMonthDate.getFullYear();
            const nextMonth = String(nextMonthDate.getMonth() + 1).padStart(2, '0');
            const toStr = `${nextYear}-${nextMonth}-01`;

            try {
                const checkRes = await query(`
                    SELECT 1 FROM pg_class c WHERE c.relname = $1
                `, [partitionName]);
                
                if (checkRes.rows.length === 0) {
                    console.log(`[TickArchiver] 建立月份分區: ${partitionName}`);
                    await query(`
                        CREATE TABLE IF NOT EXISTS ${partitionName} 
                        PARTITION OF realtime_ticks_history 
                        FOR VALUES FROM ('${fromStr}') TO ('${toStr}')
                    `);
                }
            } catch (err) {
                console.error(`[TickArchiver] 建立分區 ${partitionName} 失敗:`, err.message);
            }
        }
    },

    /**
     * 檢查指定日期是否為台灣交易日
     */
    async isTradingDay(date) {
        try {
            const dateStr = date.toISOString().split('T')[0];
            const res = await query(`
                SELECT count(*) 
                FROM trading_dates 
                WHERE date::date = $1
            `, [dateStr]);
            return parseInt(res.rows[0].count) > 0;
        } catch (err) {
            console.error('[TickArchiver] 檢查交易日失敗:', err.message);
            return true; // 預設為 true 以免漏掉歸檔
        }
    }
};

module.exports = TickArchiver;
