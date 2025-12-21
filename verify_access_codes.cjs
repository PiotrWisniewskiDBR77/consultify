/**
 * Access Codes Hardening Verification
 * 
 * Tests:
 * 1. Atomicity: parallel accepts on max_uses=1 should only succeed once
 * 2. Expired code rejection
 * 3. Revoked code rejection
 * 4. Email match enforcement
 * 5. Privacy: validate returns no sensitive info
 */

const db = require('./server/database');
const AccessCodeService = require('./server/services/accessCodeService');
const { v4: uuidv4 } = require('uuid');

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function log(msg) { console.log(`[TEST] ${msg}`); }
function pass(name) { console.log(`✅ ${name}`); }
function fail(name, err) { console.error(`❌ ${name}: ${err}`); process.exit(1); }

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

async function testAtomicity() {
    log('Test 1: Atomicity (parallel accepts on max_uses=1)');

    const code = await AccessCodeService.generateCode({
        type: 'INVITE',
        createdByUserId: uuidv4(),
        maxUses: 1,
        expiresInDays: 1
    });

    // Fire 5 parallel accepts
    const promises = [];
    for (let i = 0; i < 5; i++) {
        promises.push(AccessCodeService.acceptCode({
            code: code.code,
            actorUserId: uuidv4()
        }));
    }

    const results = await Promise.allSettled(promises);

    const successes = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
    const failures = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)).length;

    if (successes === 1 && failures === 4) {
        pass('Atomicity: only 1/5 succeeded');
    } else {
        fail('Atomicity', `Expected 1 success, 4 failures. Got ${successes} successes, ${failures} failures`);
    }
}

async function testExpiredCode() {
    log('Test 2: Expired code rejection');

    // Manually insert an expired code
    const id = `ac-${uuidv4()}`;
    const codeStr = `TEST-EXPIRED-${Date.now()}`;
    const codeHash = require('crypto').createHash('sha256').update(codeStr).digest('hex');
    const expiredAt = new Date(Date.now() - 86400000).toISOString(); // Yesterday

    await new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO access_codes (id, code, code_hash, type, max_uses, uses_count, expires_at, status, created_at)
             VALUES (?, ?, ?, 'TEST', 10, 0, ?, 'ACTIVE', CURRENT_TIMESTAMP)`,
            [id, codeStr, codeHash, expiredAt],
            (err) => err ? reject(err) : resolve()
        );
    });

    const result = await AccessCodeService.acceptCode({ code: codeStr, actorUserId: uuidv4() });

    if (!result.ok && result.error === 'CODE_NOT_CONSUMABLE') {
        pass('Expired code rejected');
    } else {
        fail('Expired code', `Expected CODE_NOT_CONSUMABLE, got ${JSON.stringify(result)}`);
    }
}

async function testRevokedCode() {
    log('Test 3: Revoked code rejection');

    const code = await AccessCodeService.generateCode({
        type: 'INVITE',
        createdByUserId: uuidv4(),
        maxUses: 10,
        expiresInDays: 30
    });

    await AccessCodeService.revokeCode(code.id);

    const result = await AccessCodeService.acceptCode({ code: code.code, actorUserId: uuidv4() });

    if (!result.ok && result.error === 'CODE_NOT_CONSUMABLE') {
        pass('Revoked code rejected');
    } else {
        fail('Revoked code', `Expected CODE_NOT_CONSUMABLE, got ${JSON.stringify(result)}`);
    }
}

async function testEmailMatch() {
    log('Test 4: Email match enforcement');

    const code = await AccessCodeService.generateCode({
        type: 'INVITE',
        createdByUserId: uuidv4(),
        targetEmail: 'correct@example.com',
        maxUses: 10,
        expiresInDays: 30
    });

    // Wrong email
    const wrongResult = await AccessCodeService.acceptCode({
        code: code.code,
        actorUserId: uuidv4(),
        providedEmail: 'wrong@example.com'
    });

    if (!wrongResult.ok && wrongResult.error === 'EMAIL_MISMATCH') {
        pass('Wrong email rejected');
    } else {
        fail('Email match (wrong)', `Expected EMAIL_MISMATCH, got ${JSON.stringify(wrongResult)}`);
    }

    // Correct email
    const correctResult = await AccessCodeService.acceptCode({
        code: code.code,
        actorUserId: uuidv4(),
        providedEmail: 'correct@example.com'
    });

    if (correctResult.ok) {
        pass('Correct email accepted');
    } else {
        fail('Email match (correct)', `Expected ok:true, got ${JSON.stringify(correctResult)}`);
    }
}

async function testPrivacy() {
    log('Test 5: Validate returns no sensitive info');

    const code = await AccessCodeService.generateCode({
        type: 'INVITE',
        createdByUserId: uuidv4(),
        organizationId: uuidv4(),
        targetEmail: 'secret@example.com',
        maxUses: 10,
        expiresInDays: 30,
        metadata: { secret: 'should_not_be_exposed' }
    });

    const result = await AccessCodeService.validatePublic(code.code);

    if (result.valid !== true) {
        fail('Privacy', 'Code should be valid');
    }

    // Check that sensitive fields are NOT present
    const forbiddenKeys = ['organizationId', 'organization_id', 'targetEmail', 'target_email', 'metadata', 'usesCount', 'uses_count', 'createdByUserId', 'created_by_user_id'];
    for (const key of forbiddenKeys) {
        if (result[key] !== undefined) {
            fail('Privacy', `Forbidden key "${key}" is present in validate response`);
        }
    }

    // Allowed: valid, type, requiresEmailMatch
    if (result.type && result.requiresEmailMatch !== undefined) {
        pass('Privacy: minimal payload confirmed');
    } else {
        fail('Privacy', 'Missing expected fields');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function runTests() {
    console.log('\n=== Access Codes Hardening Verification ===\n');

    await sleep(1000); // Wait for DB init

    try {
        await testAtomicity();
        await testExpiredCode();
        await testRevokedCode();
        await testEmailMatch();
        await testPrivacy();

        console.log('\n=== ALL TESTS PASSED ===\n');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ Unexpected Error:', err);
        process.exit(1);
    }
}

runTests();
