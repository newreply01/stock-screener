const { Pool } = require('pg');

const remotePool = new Pool({
  connectionString: 'postgresql://postgres.gfwlifpmstidgudgojwe:HfSDHrdekEY0vLPz@aws-1-us-east-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function verify() {
  try {
    const tables = ['stocks', 'daily_prices', 'fundamentals', 'fm_total_institutional', 'fm_total_margin', 'realtime_ticks'];
    
    console.log('--- Supabase Data Verification ---');
    for (const table of tables) {
      const res = await remotePool.query(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`Table ${table}: ${res.rows[0].count} rows`);
    }
  } catch (err) {
    console.error('Verification failed:', err.message);
  } finally {
    await remotePool.end();
  }
}

verify();
