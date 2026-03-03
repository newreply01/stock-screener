const { pool } = require('./server/db');

/**
 * Database Partitioning Migration Utility
 * Targets: 
 * - realtime_ticks (Daily)
 * - institutional (Yearly)
 * - daily_prices (Yearly)
 */

async function migrateTable(tableName, partitionStrategy, dateColumn) {
    console.log(`\n🚀 Starting migration for [${tableName}]...`);
    const client = await pool.connect();

    try {
        // 1. Check if already partitioned
        const checkRes = await client.query(`
            SELECT relkind FROM pg_class c 
            JOIN pg_namespace n ON n.oid = c.relnamespace 
            WHERE n.nspname = 'public' AND c.relname = $1
        `, [tableName]);

        if (checkRes.rows.length > 0 && checkRes.rows[0].relkind === 'p') {
            console.log(`⚠️ Table [${tableName}] is already partitioned. Skipping.`);
            return;
        }

        // 2. Get date range from existing data
        const rangeRes = await client.query(`SELECT MIN(${dateColumn}) as min_date, MAX(${dateColumn}) as max_date FROM ${tableName}`);
        let { min_date, max_date } = rangeRes.rows[0];

        if (!min_date) {
            console.log(`⚠️ Table [${tableName}] is empty. Creating default partitions only.`);
            min_date = new Date();
            max_date = new Date();
        }

        console.log(`📊 Data Range: ${min_date.toISOString().split('T')[0]} to ${max_date.toISOString().split('T')[0]}`);

        // 3. Rename old table
        const oldTableName = `${tableName}_old_backup`;
        console.log(`📦 Renaming [${tableName}] to [${oldTableName}]...`);
        await client.query(`ALTER TABLE ${tableName} RENAME TO ${oldTableName}`);
        await client.query(`DROP INDEX IF EXISTS idx_${tableName}_symbol_time`);
        await client.query(`DROP INDEX IF EXISTS idx_${tableName}_trade_time`);

        // 4. Create new partitioned table
        console.log(`🛠️ Creating new partitioned table [${tableName}]...`);
        if (tableName === 'realtime_ticks') {
            await client.query(`
                CREATE TABLE ${tableName} (
                    id BIGSERIAL,
                    symbol VARCHAR(10) NOT NULL REFERENCES stocks(symbol),
                    trade_time TIMESTAMP NOT NULL,
                    price NUMERIC(10,2),
                    open_price NUMERIC(10,2),
                    high_price NUMERIC(10,2),
                    low_price NUMERIC(10,2),
                    volume BIGINT,
                    trade_volume BIGINT,
                    buy_intensity SMALLINT DEFAULT 50,
                    sell_intensity SMALLINT DEFAULT 50,
                    five_levels JSONB DEFAULT '[]'::jsonb,
                    created_at TIMESTAMP DEFAULT NOW(),
                    PRIMARY KEY (symbol, trade_time)
                ) PARTITION BY RANGE (trade_time)
            `);
        } else if (tableName === 'institutional') {
            await client.query(`
                CREATE TABLE ${tableName} (
                    id BIGSERIAL,
                    symbol VARCHAR(10) NOT NULL REFERENCES stocks(symbol),
                    trade_date DATE NOT NULL,
                    foreign_buy BIGINT DEFAULT 0,
                    foreign_sell BIGINT DEFAULT 0,
                    trust_buy BIGINT DEFAULT 0,
                    trust_sell BIGINT DEFAULT 0,
                    dealer_buy BIGINT DEFAULT 0,
                    dealer_sell BIGINT DEFAULT 0,
                    total_net_buy BIGINT DEFAULT 0,
                    created_at TIMESTAMP DEFAULT NOW(),
                    PRIMARY KEY (symbol, trade_date)
                ) PARTITION BY RANGE (trade_date)
            `);
        } else if (tableName === 'daily_prices') {
            await client.query(`
                CREATE TABLE ${tableName} (
                    id BIGSERIAL,
                    symbol VARCHAR(10) NOT NULL REFERENCES stocks(symbol),
                    trade_date DATE NOT NULL,
                    open_price NUMERIC(10,2),
                    high_price NUMERIC(10,2),
                    low_price NUMERIC(10,2),
                    close_price NUMERIC(10,2),
                    trade_volume BIGINT,
                    trade_value BIGINT,
                    change_amount NUMERIC(10,2),
                    change_percent NUMERIC(5,2),
                    created_at TIMESTAMP DEFAULT NOW(),
                    PRIMARY KEY (symbol, trade_date)
                ) PARTITION BY RANGE (trade_date)
            `);
        }

        // 5. Create Partitions
        if (partitionStrategy === 'daily') {
            // Create daily partitions from min to max + 7 days
            let curr = new Date(min_date);
            curr.setHours(0, 0, 0, 0);
            const end = new Date(max_date);
            end.setDate(end.getDate() + 7);

            while (curr <= end) {
                const dateStr = curr.toISOString().split('T')[0].replace(/-/g, '_');
                const startStr = curr.toISOString().split('T')[0];
                let next = new Date(curr);
                next.setDate(next.getDate() + 1);
                const nextStr = next.toISOString().split('T')[0];

                console.log(`  📂 Creating partition [${tableName}_${dateStr}]...`);
                await client.query(`CREATE TABLE ${tableName}_${dateStr} PARTITION OF ${tableName} FOR VALUES FROM ('${startStr}') TO ('${nextStr}')`);
                curr = next;
            }
        } else if (partitionStrategy === 'yearly') {
            let startYear = min_date.getFullYear();
            let endYear = max_date.getFullYear() + 1;
            for (let y = startYear; y <= endYear; y++) {
                console.log(`  📂 Creating partition [${tableName}_${y}]...`);
                await client.query(`CREATE TABLE ${tableName}_${y} PARTITION OF ${tableName} FOR VALUES FROM ('${y}-01-01') TO ('${y + 1}-01-01')`);
            }
        }

        // 6. Migrate Data
        console.log(`🚚 Migrating data from [${oldTableName}] to [${tableName}] (This may take time)...`);
        await client.query(`INSERT INTO ${tableName} SELECT * FROM ${oldTableName}`);

        // 7. Recreate secondary indexes
        console.log(`⚡ Recreating indexes...`);
        if (tableName === 'realtime_ticks') {
            await client.query(`CREATE INDEX idx_${tableName}_trade_time ON ${tableName}(trade_time DESC)`);
        } else {
            await client.query(`CREATE INDEX idx_${tableName}_date ON ${tableName}(trade_date DESC)`);
        }

        console.log(`✅ [${tableName}] Migration Successful!`);
    } catch (err) {
        console.error(`❌ [${tableName}] Migration Failed:`, err.message);
        // Attempt to rollback rename if possible
        // Note: Real rollback requires deeper transaction management but psql handles DDL
    } finally {
        client.release();
    }
}

async function run() {
    console.log("🛠️ Starting Database Partitioning Suite...");

    // STOP CRAWLERS BEFORE RUNNING THIS MANUALLY
    // 1. Daily Ticks (Daily)
    await migrateTable('realtime_ticks', 'daily', 'trade_time');

    // 2. Institutional (Yearly)
    await migrateTable('institutional', 'yearly', 'trade_date');

    // 3. Daily Prices (Yearly)
    await migrateTable('daily_prices', 'yearly', 'trade_date');

    console.log("\n🏁 All migrations finished. Please restart your crawlers.");
    process.exit(0);
}

run();
