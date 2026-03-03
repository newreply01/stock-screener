const { pool } = require('./server/db');

async function finalFix() {
    const client = await pool.connect();
    try {
        console.log('--- Fixing daily_prices Final ---');
        await client.query('DROP TABLE IF EXISTS daily_prices CASCADE');
        await client.query(`
            CREATE TABLE daily_prices (
                id SERIAL,
                symbol VARCHAR(10) NOT NULL REFERENCES stocks(symbol),
                trade_date DATE NOT NULL,
                open_price NUMERIC,
                high_price NUMERIC,
                low_price NUMERIC,
                close_price NUMERIC,
                change_amount NUMERIC,
                change_percent NUMERIC,
                volume BIGINT,
                trade_value BIGINT,
                transactions INTEGER,
                created_at TIMESTAMP DEFAULT NOW(),
                PRIMARY KEY (symbol, trade_date)
            ) PARTITION BY RANGE (trade_date)
        `);
        for (let y = 2021; y <= 2027; y++) {
            await client.query(`CREATE TABLE daily_prices_${y} PARTITION OF daily_prices FOR VALUES FROM ('${y}-01-01') TO ('${y + 1}-01-01')`);
        }
        console.log('  Migrating data to daily_prices...');
        await client.query('INSERT INTO daily_prices SELECT * FROM daily_prices_old_backup');
        await client.query('CREATE INDEX idx_daily_prices_date ON daily_prices(trade_date DESC)');

        console.log('✅ Final Fix completed successfully!');
    } catch (e) {
        console.error('❌ Final Fix failed:', e.message);
    } finally {
        client.release();
        process.exit(0);
    }
}

finalFix();
