import path from 'path';

// Mock Logger so we don't crash if logger relies on complex context
global.aiLogger = {
    info: (ctx, msg) => console.log(`[INFO] ${ctx}: ${msg}`),
    error: (ctx, msg, err) => console.error(`[ERROR] ${ctx}: ${msg}`, err),
    warn: (ctx, msg) => console.warn(`[WARN] ${ctx}: ${msg}`)
};

async function verifyPersistence() {
    console.log('--- STARTING ROUND 1: BACKEND INTEGRITY CHECK ---');

    const { llmConfigService } = require('./services/ai/llmConfigService');

    await llmConfigService.initialize();
    console.log('Service Initialized.');

    // 3. Insert Test Log
    const testTraceId = `test_verification_${Date.now()}`;
    await llmConfigService.logEvent({
        traceId: testTraceId,
        provider: 'openai',
        model: 'gpt-4-turbo-verification',
        status: 'success',
        latencyMs: 1234,
        tokensIn: 50,
        tokensOut: 100,
        cost: 0.0045,
        errorMessage: null
    });
    console.log('Inserted success log:', testTraceId);

    // 4. insert Error Log
    const errorTraceId = `test_error_${Date.now()}`;
    await llmConfigService.logEvent({
        traceId: errorTraceId,
        provider: 'anthropic',
        model: 'claude-3-opus',
        status: 'error',
        latencyMs: 500,
        cost: 0,
        errorMessage: 'Simulated connection failure for verification'
    });
    console.log('Inserted error log:', errorTraceId);

    await new Promise(r => setTimeout(r, 1000));

    // 5. Verify Retrieval (Logs)
    console.log('Verifying Retrieval...');
    const logs = await llmConfigService.getRecentLogs(20, 0); // Check recent 20 to be safe

    const foundSuccess = logs.find(l => l.trace_id === testTraceId);
    const foundError = logs.find(l => l.trace_id === errorTraceId);

    if (!foundSuccess) throw new Error('FAILED: Standard log not found in DB');
    if (!foundError) throw new Error('FAILED: Error log not found in DB');

    if (foundSuccess.cost !== 0.0045) throw new Error(`FAILED: Cost mismatch. Expected 0.0045, got ${foundSuccess.cost}`);
    if (foundSuccess.latency_ms !== 1234) throw new Error(`FAILED: Latency mismatch. Expected 1234, got ${foundSuccess.latency_ms}`);

    console.log('✅ Log Retrieval Verified.');

    // 6. Verify Analytics
    console.log('Verifying Analytics Aggregation...');
    const stats = await llmConfigService.getAnalyticsParams(1); // last 1 day

    console.log('Stats:', JSON.stringify(stats, null, 2));

    if (stats.total_requests < 2) throw new Error('FAILED: Analytics total_requests too low');
    if (stats.error_count < 1) throw new Error('FAILED: Analytics error_count too low');

    console.log('✅ Analytics Verified.');
    console.log('--- ROUND 1 SUCCESS: BACKEND INTEGRITY CONFIRMED ---');
    process.exit(0);
}

verifyPersistence().catch(err => {
    console.error('XXX ROUND 1 FAILED XXX', err);
    process.exit(1);
});
