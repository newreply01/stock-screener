const { query } = require('./db');
async function run() {
    const res = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'dividend_policy'");
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
}
run();
