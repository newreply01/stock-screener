const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function createTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ai_prompt_templates (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) NOT NULL,
                content TEXT NOT NULL,
                version INTEGER NOT NULL,
                is_active BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Table Created Successfully');
    } catch (e) {
        console.error('Table Creation Failed:', e);
    } finally {
        await pool.end();
    }
}

createTable();
