
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, '../server/consultify.db');
const db = new sqlite3.Database(dbPath);
const { v4: uuidv4 } = require('uuid');

async function runTest() {
    console.log('Verifying Margin System...');

    // Mock TokenBillingService methods (we can't require it easily if it depends on DB connection instance that isn't shared properly in script mode, 
    // but here we are using the real DB file so we can just reproduce the logic or require the service if it exports a class that uses the module-level db).
    // The service requires '../database', which initializes a connection.
    // Let's try requiring the service.

    // Hack: Set NODE_ENV to avoid dropping tables
    process.env.NODE_ENV = 'production';
    const TokenBillingService = require('../server/services/tokenBillingService');

    // 1. Setup User
    const userId = 'test-user-margin-' + Date.now();
    await new Promise(r => db.run("INSERT INTO users (id, email) VALUES (?, ?)", [userId, `test-${Date.now()}@example.com`], r));

    // 2. Credit Tokens
    console.log('Crediting 1000 tokens...');
    await TokenBillingService.creditTokens(userId, 1000, 0);

    // 3. Verify Balance
    let balance = await TokenBillingService.getBalance(userId);
    console.log(`Balance: ${balance.platform_tokens} (Expected: 1000)`);
    if (balance.platform_tokens !== 1000) throw new Error('Balance mismatch');

    // 4. Test Multiplier Deduction
    // 100 tokens * 5.0 multiplier = 500 tokens deduction
    const multiplier = 5.0;
    const rawTokens = 100;
    console.log(`Deducting ${rawTokens} tokens with ${multiplier}x multiplier...`);

    await TokenBillingService.deductTokens(userId, rawTokens, 'platform', {
        llmProvider: 'test-provider',
        modelUsed: 'gpt-X',
        multiplier: multiplier
    });

    // 5. Verify Balance
    balance = await TokenBillingService.getBalance(userId);
    console.log(`Balance: ${balance.platform_tokens} (Expected: 500)`);
    if (balance.platform_tokens !== 500) {
        throw new Error(`Failed! Expected 500, got ${balance.platform_tokens}`);
    }

    // 6. Verify Transaction Metadata
    const tx = await new Promise(resolve => {
        db.get('SELECT * FROM token_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [userId], (err, row) => resolve(row));
    });
    console.log('Transaction Metadata:', tx.metadata);
    const meta = JSON.parse(tx.metadata);
    if (meta.raw_tokens !== 100 || meta.multiplier !== 5.0) {
        throw new Error('Metadata mismatch');
    }

    console.log('SUCCESS: Margin / Multiplier logic verified.');
}

runTest().then(() => {
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
