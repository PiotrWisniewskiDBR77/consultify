/**
 * AI System Diagnostic Tool
 * Run: node scripts/diagnose_ai_system.js
 */

const http = require('http');

const API_BASE = 'http://localhost:3005/api/llm';

async function callApi(endpoint, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${API_BASE}${endpoint}`);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        });

        req.on('error', (e) => reject(e));
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function runDiagnostics() {
    console.log('--- Consultify AI System Diagnostics ---');
    
    try {
        console.log('\n1. Checking Basic API Health...');
        const health = await callApi('/health-check-ai');
        console.log('   Result:', health);

        console.log('\n2. Running System Diagnose & Repair...');
        const diagnosis = await callApi('/diagnose');
        console.log('   Status:', diagnosis.status);
        if (diagnosis.repairs?.length > 0) {
            console.log('   Repairs performed:', diagnosis.repairs);
        }

        console.log('\n3. Checking AI Pipeline Status...');
        const status = await callApi('/health/status');
        console.log('   Active Providers:', status.providers?.filter(p => p.status === 'ACTIVE').length || 0);
        console.log('   Metrics:', status.metrics);

        console.log('\n4. Testing Core Connection Capability...');
        const connTest = await callApi('/health/test/connection', 'POST', { context: {} });
        console.log('   Status:', connTest.status);
        console.log('   Latency:', connTest.latency, 'ms');
        if (connTest.error) console.log('   Error:', connTest.error);

        console.log('\nDiagnostic Complete.');
    } catch (err) {
        console.error('\n[FATAL] Diagnostic failed:', err.message);
        console.log('Ensure the server is running at http://localhost:3005');
    }
}

runDiagnostics();





