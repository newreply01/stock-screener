const { pool } = require('./server/db');

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('1. Renaming old partitioned table to legacy...');
        await client.query('ALTER TABLE IF EXISTS realtime_ticks RENAME TO realtime_ticks_old');

        console.log('2. Creating realtime_ticks_history table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS realtime_ticks_history (
                id bigint,
                symbol varchar(10) NOT NULL,
                trade_time timestamp NOT NULL,
                price numeric(10,2),
                open_price numeric(10,2),
                high_price numeric(10,2),
                low_price numeric(10,2),
                volume bigint,
                trade_volume bigint,
                buy_intensity smallint DEFAULT 50,
                sell_intensity smallint DEFAULT 50,
                five_levels jsonb DEFAULT '[]'::jsonb,
                created_at timestamp DEFAULT now(),
                previous_close numeric(10,2)
            )
        `);
        // Add index for fast historical lookups
        await client.query('CREATE INDEX IF NOT EXISTS idx_realtime_history_sym_time ON realtime_ticks_history (symbol, trade_time DESC)');

        console.log('3. Creating NEW realtime_ticks (Hot Table) as a standard heap...');
        await client.query(`
            CREATE TABLE realtime_ticks (
                id BIGSERIAL,
                symbol varchar(10) NOT NULL,
                trade_time timestamp NOT NULL,
                price numeric(10,2),
                open_price numeric(10,2),
                high_price numeric(10,2),
                low_price numeric(10,2),
                volume bigint,
                trade_volume bigint,
                buy_intensity smallint DEFAULT 50,
                sell_intensity smallint DEFAULT 50,
                five_levels jsonb DEFAULT '[]'::jsonb,
                created_at timestamp DEFAULT now(),
                previous_close numeric(10,2),
                PRIMARY KEY (symbol, trade_time)
            )
        `);

        console.log('4. Moving data from old partitioned table (if any) to history...');
        // This handles cases where data might be in partitions we can't easily see
        try {
            await client.query('INSERT INTO realtime_ticks_history SELECT * FROM realtime_ticks_old');
            console.log('Data moved successfully.');
        } catch (e) {
            console.log('No data to move or transition error:', e.message);
        }

        await client.query('COMMIT');
        console.log('Migration complete!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration FAILED:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
