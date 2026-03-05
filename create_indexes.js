const { query } = require('./server/db');

async function createIndexes() {
    try {
        console.log("Creating idx_stocks_is_stock...");
        await query(`CREATE INDEX IF NOT EXISTS idx_stocks_is_stock ON stocks ((symbol ~ '^[0-9]{4}$' AND symbol !~ '^00'))`);

        console.log("Creating idx_stocks_market...");
        await query(`CREATE INDEX IF NOT EXISTS idx_stocks_market ON stocks (market)`);

        console.log("Creating idx_stocks_industry...");
        await query(`CREATE INDEX IF NOT EXISTS idx_stocks_industry ON stocks (industry)`);

        console.log("Creating idx_inst_date...");
        await query(`CREATE INDEX IF NOT EXISTS idx_inst_date ON institutional (trade_date DESC)`);

        console.log("All indexes created successfully.");
        process.exit(0);
    } catch (err) {
        console.error("Index creation failed:", err);
        process.exit(1);
    }
}

createIndexes();
