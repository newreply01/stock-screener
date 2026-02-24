const { pool } = require('./db');

async function getStats() {
    try {
        console.log('--- FinMind Sync Stats Report ---');
        
        // 1. Total Stocks (4 digits)
        const stocksRes = await pool.query("SELECT COUNT(*) FROM stocks WHERE symbol ~ '^[0-9]{4}$'");
        const totalStocks = parseInt(stocksRes.rows[0].count);
        console.log(`Total 4-digit stocks: ${totalStocks}`);

        // 2. Progress summary per dataset
        const progressRes = await pool.query(`
            SELECT 
                dataset, 
                COUNT(*) as completed_count, 
                MAX(last_sync_date) as last_sync 
            FROM fm_sync_progress 
            GROUP BY dataset 
            ORDER BY completed_count DESC
        `);
        
        console.log('\nDataset Progress:');
        console.table(progressRes.rows.map(row => ({
            Dataset: row.dataset,
            Completed: row.completed_count,
            'Progress (%)': ((row.completed_count / (row.dataset.includes('StockPrice') || row.dataset.includes('PER') || row.dataset.includes('DayTrading') || row.dataset.includes('FinancialStatements') || row.dataset.includes('BalanceSheet') || row.dataset.includes('CashFlows') || row.dataset.includes('Dividend') || row.dataset.includes('MonthRevenue') || row.dataset.includes('News') ? totalStocks : 1)) * 100).toFixed(2) + '%',
            'Last Sync': row.last_sync
        })));

        // 3. Overall Activity
        const recentRes = await pool.query('SELECT * FROM fm_sync_progress ORDER BY last_sync_date DESC LIMIT 5');
        console.log('\nRecent activity:');
        console.table(recentRes.rows);

    } catch (err) {
        console.error('Error fetching stats:', err);
    } finally {
        await pool.end();
    }
}

getStats();
