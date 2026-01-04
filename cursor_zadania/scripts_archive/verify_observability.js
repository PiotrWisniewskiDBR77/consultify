import express from 'express';
import request from 'supertest';
import { correlationMiddleware } from '../server/utils/requestStore.js'; // Note .js extension
import logger from '../server/utils/logger.js';

const app = express();

// Mock middleware setup
app.use(correlationMiddleware);
app.use(logger.requestLogger);

app.get('/test-observability', (req, res) => {
    logger.info('Test log message');
    res.json({ status: 'ok', correlationId: req.correlationId });
});

async function verify() {
    console.log('Running Observability Verification...');

    try {
        const res = await request(app).get('/test-observability');

        if (res.status === 200 && res.body.correlationId && res.headers['x-correlation-id']) {
            console.log('✅ Verification Passed: Correlation ID detected.');
            console.log(`   ID: ${res.body.correlationId}`);
        } else {
            console.error('❌ Verification Failed: Missing Correlation ID.');
            console.error('   Body:', res.body);
            console.error('   Headers:', res.headers);
            process.exit(1);
        }
    } catch (err) {
        console.error('❌ Verification Failed:', err);
        process.exit(1);
    }
}

verify();
