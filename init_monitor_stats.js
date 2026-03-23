const { updateDailyStats } = require('./server/utils/statsAggregator');

async function init() {
    const days = 14;
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        try {
            await updateDailyStats(dateStr);
        } catch (e) {
            console.error(`Failed for ${dateStr}:`, e.message);
        }
    }
    process.exit(0);
}

init();
