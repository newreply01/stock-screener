const { pool } = require('./server/db');
(async () => {
    try {
        await pool.query("UPDATE ai_generation_queue SET status = 'pending', start_at = NULL WHERE status = 'processing'");
        console.log('✅ 已成功將所有懸掛中的任務重置為 pending。');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
