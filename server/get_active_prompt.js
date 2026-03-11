const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { query } = require('./db');

async function getPrompt() {
  try {
    const res = await query("SELECT content FROM ai_prompt_templates WHERE is_active = true LIMIT 1");
    if (res.rows.length > 0) {
      console.log('---PROMPT_START---');
      console.log(res.rows[0].content);
      console.log('---PROMPT_END---');
    } else {
      console.log('No active prompt found.');
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

getPrompt();
