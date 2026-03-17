const { query } = require('./server/db');
async function run() {
    try {
        const res = await query("SELECT * FROM realtime_ticks WHERE symbol = 'TAIEX' ORDER BY trade_time DESC LIMIT 5");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    }
}
run();
