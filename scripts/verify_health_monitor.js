import { healthMonitor } from '../server/services/ai/healthMonitor.js';

console.log('Verifying AI Health Monitor...');

// Mock database promise
import dbPromise from '../server/utils/dbPromise.js';
// We might need to mock dbPromise if it tries to connect immediately
// But let's see if we can run it without mocking first, assuming config is resilient

async function verify() {
    try {
        console.log('1. Starting Monitor...');
        healthMonitor.start(1000); // 1s interval

        console.log('2. Fetching Status...');
        const status = healthMonitor.getStatus();

        console.log('Status Structure:', JSON.stringify(status, null, 2));

        if (status.isRunning === true && status.providers) {
            console.log('✅ Health Monitor Verification Passed');
        } else {
            console.error('❌ Health Monitor Verification Failed: Invalid structure');
            process.exit(1);
        }

        healthMonitor.stop();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

verify();
