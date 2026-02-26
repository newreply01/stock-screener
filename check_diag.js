const { pool } = require('./server/db');
const { execSync } = require('child_process');

async function diag() {
    try {
        console.log('--- Diagnostic Report ---');
        console.log('WSL Time:', new Date().toString());

        const dbRes = await pool.query('SELECT NOW()');
        console.log('DB NOW():', dbRes.rows[0].now);

        const disk = execSync('df -h /').toString();
        console.log('Disk Space:\n', disk);

        const mem = execSync('free -m').toString();
        console.log('Memory Usage:\n', mem);

        process.exit(0);
    } catch (e) {
        console.error('Diag Failed:', e);
        process.exit(1);
    }
}
diag();
