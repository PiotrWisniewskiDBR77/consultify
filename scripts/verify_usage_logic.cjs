const usageService = require('../server/services/usageService');
const db = require('../server/database');
const { v4: uuidv4 } = require('uuid');

async function runVerification() {
    console.log('--- STARTING USAGE LOGIC VERIFICATION ---');

    const orgId = `test-org-${uuidv4()}`;
    const periodStart = new Date();
    periodStart.setDate(1); // 1st of this month

    const lastMonth = new Date(periodStart);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    // Mock Billing Data (since usageService calls billingService)
    // We can just rely on defaults or mock the DB call if needed.
    // For simplicity, we insert usage records directly.

    console.log(`Test Org ID: ${orgId}`);

    try {
        // 1. Insert OLD Token Usage (Last Month)
        // Should NOT be counted
        await insertUsage(orgId, 'token', 1000, lastMonth);
        console.log('Inserted 1000 tokens for LAST MONTH');

        // 2. Insert NEW Token Usage (This Month)
        // SHOULD be counted
        await insertUsage(orgId, 'token', 500, new Date());
        console.log('Inserted 500 tokens for THIS MONTH');

        // 3. Insert OLD Storage Usage (Last Month)
        // SHOULD be counted (Cumulative)
        await insertUsage(orgId, 'storage', 1024 * 1024 * 100, lastMonth); // 100MB
        console.log('Inserted 100MB storage for LAST MONTH');

        // 4. Insert NEW Storage Usage (This Month)
        // SHOULD be counted (Cumulative)
        await insertUsage(orgId, 'storage', 1024 * 1024 * 50, new Date()); // 50MB
        console.log('Inserted 50MB storage for THIS MONTH');

        // 5. Get Usage
        // We expect tokens = 500, storage = 150MB
        // NOTE: usageService.getCurrentUsage fetches plan info which might fail if org doesn't exist in billing tables.
        // We'll see if it handles null plan gracefully (it seems to).
        console.log('Fetching usage...');
        const usage = await usageService.getCurrentUsage(orgId);

        console.log('--- RESULTS ---');
        console.log(`Tokens Used: ${usage.tokens.used} (Expected: 500)`);
        console.log(`Storage Used: ${(usage.storage.used / (1024 * 1024)).toFixed(2)} MB (Expected: 150.00)`);

        if (usage.tokens.used === 500 && usage.storage.used === (1024 * 1024 * 150)) {
            console.log('✅ RECORDING VERIFICATION PASSED');
        } else {
            console.error('❌ RECORDING VERIFICATION FAILED');
        }

        // 6. Test Deletion Logic
        console.log('--- TESTING DELETION ---');
        // We'll simulate a file deletion which writes a negative usage record
        await insertUsage(orgId, 'storage', -(1024 * 1024 * 50), new Date()); // Delete 50MB
        console.log('Simulated deletion of 50MB file');

        const usageAfterDelete = await usageService.getCurrentUsage(orgId);
        console.log(`Storage Used After Delete: ${(usageAfterDelete.storage.used / (1024 * 1024)).toFixed(2)} MB (Expected: 100.00)`);

        if (usageAfterDelete.storage.used === (1024 * 1024 * 100)) {
            console.log('✅ DELETION VERIFICATION PASSED');
        } else {
            console.error('❌ DELETION VERIFICATION FAILED');
        }

    } catch (err) {
        console.error('Test Error:', err);
    }
}

function insertUsage(orgId, type, amount, date) {
    return new Promise((resolve, reject) => {
        const id = `test-${uuidv4()}`;
        db.run(
            `INSERT INTO usage_records (id, organization_id, type, amount, action, recorded_at, metadata)
             VALUES (?, ?, ?, ?, 'test', ?, '{}')`,
            [id, orgId, type, amount, date.toISOString()],
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}

runVerification();
