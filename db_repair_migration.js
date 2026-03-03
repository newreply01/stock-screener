const { pool } = require('./server/db');

async function fix() {
    const client = await pool.connect();
    try {
        console.log('--- Repairing institutional ---');
        await client.query('DROP TABLE IF EXISTS institutional CASCADE');
        await client.query(`
            CREATE TABLE institutional (
                id SERIAL,
                symbol VARCHAR(10) NOT NULL REFERENCES stocks(symbol),
                trade_date DATE NOT NULL,
                foreign_buy BIGINT DEFAULT 0,
                foreign_sell BIGINT DEFAULT 0,
                foreign_net BIGINT DEFAULT 0,
                trust_buy BIGINT DEFAULT 0,
                trust_sell BIGINT DEFAULT 0,
                trust_net BIGINT DEFAULT 0,
                dealer_buy BIGINT DEFAULT 0,
                dealer_sell BIGINT DEFAULT 0,
                dealer_net BIGINT DEFAULT 0,
                total_net BIGINT DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW(),
                PRIMARY KEY (symbol, trade_date)
            ) PARTITION BY RANGE (trade_date)
        `);
        for (let y = 2021; y <= 2027; y++) {
            await client.query(`CREATE TABLE institutional_${y} PARTITION OF institutional FOR VALUES FROM ('${y}-01-01') TO ('${y + 1}-01-01')`);
        }
        console.log('  Migrating data to institutional...');
        await client.query('INSERT INTO institutional SELECT * FROM institutional_old_backup');
        await client.query('CREATE INDEX idx_institutional_date ON institutional(trade_date DESC)');

        console.log('--- Repairing daily_prices ---');
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

        console.log('✅ Repair completed successfully!');
    } catch (e) {
        console.error('❌ Repair failed:', e.message);
    } finally {
        client.release();
        process.exit(0);
    }
}

fix();
