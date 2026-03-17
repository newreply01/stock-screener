const { query } = require('./server/db');
async function run() {
    try {
        const res = await query('SELECT * FROM stocks WHERE symbol = \'TAIEX\'');
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    }
}
run();
