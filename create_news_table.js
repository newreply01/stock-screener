const { pool } = require('./server/db');

async function createNewsTable() {
    const client = await pool.connect();
    try {
        console.log('🔄 Creating news table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS news (
                id SERIAL PRIMARY KEY,
                news_id BIGINT UNIQUE NOT NULL,
                category VARCHAR(50) NOT NULL,
                title TEXT NOT NULL,
                summary TEXT,
                content TEXT,
                image_url TEXT,
                publish_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('✅ News table created.');

        console.log('🔄 Creating indexes...');
        await client.query(`CREATE INDEX IF NOT EXISTS idx_news_publish_at ON news(publish_at);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_news_category ON news(category);`);
        console.log('✅ Indexes created.');

    } catch (err) {
        console.error('❌ Failed to create table:', err);
    } finally {
        client.release();
        pool.end();
    }
}

createNewsTable();
