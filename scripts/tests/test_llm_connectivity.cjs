#!/usr/bin/env node
/**
 * LLM Connectivity Test Suite
 * 
 * Tests all configured LLM providers for:
 * - API connectivity
 * - Response latency
 * - Model availability
 * - Rate limit status
 * - Fallback chain verification
 */

const https = require('https');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

// Load environment
const ENV_PATH = path.join(__dirname, '../../.env');
const DB_PATH = path.join(__dirname, '../../server/database.sqlite');

function loadEnv() {
    if (!fs.existsSync(ENV_PATH)) return {};
    const content = fs.readFileSync(ENV_PATH, 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            env[match[1].trim()] = match[2].trim().replace(/^["'](.*)["']$/, '$1');
        }
    });
    return env;
}

// Provider test configurations
const PROVIDERS = [
    {
        name: 'OpenAI',
        envKey: 'OPENAI_API_KEY',
        hostname: 'api.openai.com',
        testPath: '/v1/models',
        method: 'GET',
        authHeader: (key) => ({ 'Authorization': `Bearer ${key}` }),
        parseResponse: (body) => JSON.parse(body).data?.length > 0
    },
    {
        name: 'Google Gemini',
        envKey: 'GEMINI_API_KEY',
        hostname: 'generativelanguage.googleapis.com',
        testPath: (key) => `/v1beta/models?key=${key}`,
        method: 'GET',
        authHeader: () => ({}),
        parseResponse: (body) => JSON.parse(body).models?.length > 0
    },
    {
        name: 'DeepSeek',
        envKey: 'DEEPSEEK_API_KEY',
        hostname: 'api.deepseek.com',
        testPath: '/models',
        method: 'GET',
        authHeader: (key) => ({ 'Authorization': `Bearer ${key}` }),
        parseResponse: (body) => {
            try { return JSON.parse(body).data !== undefined; }
            catch { return false; }
        }
    },
    {
        name: 'Qwen (Alibaba)',
        envKey: 'QWEN_API_KEY',
        hostname: 'dashscope-intl.aliyuncs.com',
        testPath: '/compatible-mode/v1/models',
        method: 'GET',
        authHeader: (key) => ({ 'Authorization': `Bearer ${key}` }),
        parseResponse: () => true // Qwen may not have models endpoint
    },
    {
        name: 'Z.AI (Zhipu)',
        envKey: 'ZAI_API_KEY',
        hostname: 'open.bigmodel.cn',
        testPath: '/api/paas/v4/models',
        method: 'GET',
        authHeader: (key) => ({ 'Authorization': `Bearer ${key}` }),
        parseResponse: () => true
    },
    {
        name: 'Cohere',
        envKey: 'COHERE_API_KEY',
        hostname: 'api.cohere.ai',
        testPath: '/v1/models',
        method: 'GET',
        authHeader: (key) => ({ 'Authorization': `Bearer ${key}` }),
        parseResponse: (body) => {
            try { return JSON.parse(body).models?.length > 0; }
            catch { return false; }
        }
    },
    {
        name: 'NVIDIA NIM',
        envKey: 'NVIDIA_API_KEY',
        hostname: 'integrate.api.nvidia.com',
        testPath: '/v1/models',
        method: 'GET',
        authHeader: (key) => ({ 'Authorization': `Bearer ${key}` }),
        parseResponse: (body) => {
            try { return JSON.parse(body).data?.length > 0; }
            catch { return false; }
        }
    }
];

// Test functions
function makeRequest(provider, apiKey, timeout = 10000) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const testPath = typeof provider.testPath === 'function' 
            ? provider.testPath(apiKey) 
            : provider.testPath;

        const options = {
            hostname: provider.hostname,
            path: testPath,
            method: provider.method,
            headers: {
                'Content-Type': 'application/json',
                ...provider.authHeader(apiKey)
            },
            timeout
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                const latency = Date.now() - startTime;
                
                if (res.statusCode === 200) {
                    try {
                        const valid = provider.parseResponse(body);
                        resolve({
                            success: valid,
                            latency,
                            statusCode: res.statusCode,
                            message: valid ? 'Connection OK' : 'Invalid response format'
                        });
                    } catch (e) {
                        resolve({
                            success: false,
                            latency,
                            statusCode: res.statusCode,
                            message: `Parse error: ${e.message}`
                        });
                    }
                } else {
                    let errorMsg = `HTTP ${res.statusCode}`;
                    try {
                        const errBody = JSON.parse(body);
                        errorMsg = errBody.error?.message || errBody.message || errorMsg;
                    } catch {}
                    resolve({
                        success: false,
                        latency,
                        statusCode: res.statusCode,
                        message: errorMsg.substring(0, 100)
                    });
                }
            });
        });

        req.on('error', (e) => {
            resolve({
                success: false,
                latency: Date.now() - startTime,
                statusCode: 0,
                message: e.message
            });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({
                success: false,
                latency: timeout,
                statusCode: 0,
                message: 'Timeout'
            });
        });

        req.end();
    });
}

async function testDatabaseProviders() {
    return new Promise((resolve) => {
        if (!fs.existsSync(DB_PATH)) {
            resolve({ success: false, message: 'Database not found', providers: [] });
            return;
        }

        const db = new sqlite3.Database(DB_PATH);
        db.all('SELECT id, name, provider, is_active, is_default FROM llm_providers', [], (err, rows) => {
            db.close();
            if (err) {
                resolve({ success: false, message: err.message, providers: [] });
            } else {
                resolve({
                    success: true,
                    providers: rows || [],
                    activeCount: (rows || []).filter(r => r.is_active).length,
                    hasDefault: (rows || []).some(r => r.is_default)
                });
            }
        });
    });
}

async function testFallbackChain(env) {
    const results = [];
    const activeProviders = [];

    for (const provider of PROVIDERS) {
        const apiKey = env[provider.envKey];
        if (apiKey) {
            const result = await makeRequest(provider, apiKey);
            if (result.success) {
                activeProviders.push(provider.name);
            }
            results.push({
                provider: provider.name,
                ...result
            });
        }
    }

    return {
        success: activeProviders.length >= 2,
        activeProviders,
        message: activeProviders.length >= 2 
            ? `Fallback chain has ${activeProviders.length} providers`
            : 'Insufficient fallback providers (need at least 2)'
    };
}

// Main test runner
async function runTests() {
    const env = loadEnv();
    const tests = [];
    let passed = 0;
    let failed = 0;

    // Test 1: Environment keys present
    const keysPresent = PROVIDERS.filter(p => env[p.envKey]).length;
    tests.push({
        name: 'API Keys Present',
        passed: keysPresent >= 1,
        message: `${keysPresent}/${PROVIDERS.length} keys configured`
    });
    if (keysPresent >= 1) passed++; else failed++;

    // Test 2-8: Individual provider connectivity
    for (const provider of PROVIDERS) {
        const apiKey = env[provider.envKey];
        
        if (!apiKey) {
            tests.push({
                name: `${provider.name} Connectivity`,
                passed: null,
                status: 'skipped',
                message: 'No API key configured'
            });
            continue;
        }

        const result = await makeRequest(provider, apiKey);
        tests.push({
            name: `${provider.name} Connectivity`,
            passed: result.success,
            latency: result.latency,
            message: result.message
        });
        if (result.success) passed++; else failed++;
    }

    // Test 9: Database provider configuration
    const dbResult = await testDatabaseProviders();
    tests.push({
        name: 'Database Provider Config',
        passed: dbResult.success && dbResult.providers.length > 0,
        message: dbResult.success 
            ? `${dbResult.activeCount} active providers, default: ${dbResult.hasDefault ? 'yes' : 'no'}`
            : dbResult.message
    });
    if (dbResult.success && dbResult.providers.length > 0) passed++; else failed++;

    // Test 10: Fallback chain
    const fallbackResult = await testFallbackChain(env);
    tests.push({
        name: 'Fallback Chain',
        passed: fallbackResult.success,
        message: fallbackResult.message
    });
    if (fallbackResult.success) passed++; else failed++;

    // Test 11: Latency check (at least one provider < 5s)
    const latencies = tests.filter(t => t.latency).map(t => t.latency);
    const hasAcceptableLatency = latencies.some(l => l < 5000);
    tests.push({
        name: 'Acceptable Latency (<5s)',
        passed: hasAcceptableLatency,
        message: latencies.length > 0 
            ? `Best: ${Math.min(...latencies)}ms, Worst: ${Math.max(...latencies)}ms`
            : 'No latency data'
    });
    if (hasAcceptableLatency) passed++; else failed++;

    return { passed, failed, tests };
}

// Export for master runner
module.exports = { runTests };

// Run directly if executed
if (require.main === module) {
    runTests().then(results => {
        console.log('\nLLM Connectivity Test Results:');
        console.log('─'.repeat(50));
        results.tests.forEach(t => {
            const status = t.passed === null ? '⊘' : (t.passed ? '✓' : '✗');
            console.log(`${status} ${t.name}: ${t.message}`);
        });
        console.log('─'.repeat(50));
        console.log(`Passed: ${results.passed}, Failed: ${results.failed}`);
        process.exit(results.failed > 0 ? 1 : 0);
    });
}

