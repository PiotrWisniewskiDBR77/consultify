import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001/api';

async function verifySignals() {
    console.log('🚦 Starting Signalizator Verification...');

    // 1. Blue Light (Standard Feedback)
    try {
        console.log('\n🔹 1. Testing Blue Light (Standard User Feedback)...');
        const res1 = await fetch(`${BASE_URL}/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: 'test-verifier',
                userEmail: 'verify@technolex.com',
                type: 'IDEA',
                message: 'Auto-Verification: Blue Light Test Idea'
            })
        });
        console.log(`   Response: ${res1.status} ${res1.statusText}`);
    } catch (e) {
        console.error('   Failed:', e.message);
    }

    // 2. Amber Light (Critical Bug)
    try {
        console.log('\n🔸 2. Testing Amber Light (Critical Client Ticket)...');
        const res2 = await fetch(`${BASE_URL}/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: 'test-verifier',
                userEmail: 'verify@technolex.com',
                type: 'BUG',
                message: 'Auto-Verification: Amber Light Critical Bug',
                severity: 'CRITICAL'
            })
        });
        console.log(`   Response: ${res2.status} ${res2.statusText}`);
    } catch (e) {
        console.error('   Failed:', e.message);
    }

    // 3. Red Light (System Alert)
    try {
        console.log('\n🔴 3. Testing Red Light (System Alert via 500 Error)...');
        // This endpoint throws a 500 error intentionally
        const res3 = await fetch(`${BASE_URL}/test/force-error`);
        console.log(`   Response: ${res3.status} ${res3.statusText} (Expected: 500)`);
    } catch (e) {
        console.error('   Failed:', e.message);
    }

    console.log('\n✅ Verification requests completed.');
}

verifySignals();
