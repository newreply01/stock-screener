const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { generateAIReport } = require('../server/utils/ai_service');

async function test() {
    const symbol = '2330';
    console.log('[Test] Testing qwen3.5:9b with symbol 2330...');
    const result = await generateAIReport(symbol, 'qwen3.5:9b');
    if (result.success) {
        console.log('[Test] Success! Content length: ' + result.content.length);
        console.log('[Test] Content preview: ' + result.content.substring(0, 200));
    } else {
        console.error('[Test] Failed: ' + result.error);
    }
}
test();
