const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./server/db');
const { generateAIReport } = require('./server/utils/ai_service');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function processNextTask() {
    try {
        // 1. 領取任務：優先處理舊日期、高成交量的 pending 任務
        const res = await pool.query(`
            UPDATE ai_generation_queue
            SET status = 'processing', start_at = NOW()
            WHERE (report_date, symbol) = (
                SELECT report_date, symbol FROM ai_generation_queue 
                WHERE status = 'pending'
                ORDER BY report_date ASC, priority_value DESC LIMIT 1
                FOR UPDATE SKIP LOCKED
            )
            RETURNING symbol, report_date, model_name;
        `);

        if (res.rowCount === 0) {
            return null; // 無 pending 任務
        }

        const task = res.rows[0];
        return { 
            symbol: task.symbol, 
            reportDate: task.report_date instanceof Date ? task.report_date.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }) : task.report_date,
            modelName: task.model_name
        };

    } catch (err) {
        console.error('領取任務時發生錯誤:', err);
        return null;
    }
}

async function markTaskResult(symbol, reportDate, status, errMsg = null, mode = 'ollama', modelName = 'gpt-oss:20b') {
    await pool.query(`
        UPDATE ai_generation_queue
        SET status = $1, completed_at = NOW(), error_msg = $2, generation_mode = $3, model_name = $4
        WHERE report_date = $5 AND symbol = $6
    `, [status, errMsg, mode, modelName, reportDate, symbol]);
}

async function updateScriptStatus(status, message) {
    try {
        await pool.query(`
            INSERT INTO script_status (script, last_run, status, message)
            VALUES ('update_ai_reports.js', NOW(), $1, $2)
            ON CONFLICT (script) DO UPDATE SET 
                last_run = EXCLUDED.last_run,
                status = EXCLUDED.status,
                message = EXCLUDED.message
        `, [status, message]);
    } catch (err) {
        console.error('Failed to update script status:', err);
    }
}

async function runQueueProcessor() {
    console.log(`--- [Resident Worker] AI 分流生成系統啟動 ---`);
    console.log(`--- 分流策略: 前 300 檔 (gpt-os:20b) / 其餘 (qwen3.5:9b) ---`);

    let consecutiveErrors = 0;

    while (true) {
        const task = await processNextTask();
        
        if (!task) {
            console.log(`[${new Date().toLocaleTimeString()}] 無待處理任務，10 分鐘後重試...`);
            await updateScriptStatus('WAITING', '所有任務已完成，待命中 (依據成交量排序)');
            await sleep(600000); 
            continue;
        }

        const { symbol, reportDate, modelName } = task;
        console.log(`\n[${new Date().toLocaleTimeString()}] ▶️ 正在分析 [${reportDate}] ${symbol} (使用模型: ${modelName})...`);
        await updateScriptStatus('RUNNING', `正在分析標的: ${symbol} (${modelName})`);
        const start = Date.now();

        try {
            // 調用 AI Service 並傳入指定模型
            const result = await generateAIReport(symbol, modelName);

            if (result.success) {
                const elapsed = ((Date.now() - start)/1000).toFixed(1);
                console.log(`  ✅ ${symbol} 成功 (${elapsed}s, 核心: ${modelName})`);
                await markTaskResult(symbol, reportDate, 'completed', null, 'ollama', modelName);
                consecutiveErrors = 0;
            } else {
                console.error(`  ❌ ${symbol} 失敗: ${result.error}`);
                await markTaskResult(symbol, reportDate, 'failed', result.error, 'none', modelName);
                consecutiveErrors++;
            }
        } catch (err) {
            console.error(`  ❌ ${symbol} 異常: ${err.message}`);
            await markTaskResult(symbol, reportDate, 'failed', err.message, 'none', modelName);
            consecutiveErrors++;
        }

        if (consecutiveErrors >= 5) {
            console.error(`⚠️ 連續失敗 5 次，強制冷卻 15 分鐘...`);
            await sleep(900000); 
            consecutiveErrors = 0;
        } else {
            await sleep(2000); 
        }
    }
}

runQueueProcessor().catch(err => {
    console.error('Worker 崩潰:', err);
    process.exit(1);
});
