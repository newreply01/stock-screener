const { query } = require('./server/db');

async function createTable() {
    try {
        console.log("Creating market_focus_daily table...");
        await query(`
            CREATE TABLE IF NOT EXISTS market_focus_daily (
                trade_date DATE NOT NULL,
                market VARCHAR(10) NOT NULL,
                stock_types VARCHAR(50) NOT NULL,
                turnover JSONB,
                hot JSONB,
                foreign3d JSONB,
                trust3d JSONB,
                main3d JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (trade_date, market, stock_types)
            );
        `);
        console.log("Table created successfully.");
        process.exit(0);
    } catch (err) {
        console.error("Table creation failed:", err);
        process.exit(1);
    }
}

createTable();
