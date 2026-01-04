#!/usr/bin/env node
/**
 * test_all_llm.cjs - Comprehensive LLM Connection Test Script
 * 
 * Tests all configured LLM providers with actual API calls.
 * Run: node scripts/test_all_llm.cjs
 * 
 * Sources of truth:
 * - .env (API keys)
 * - llm_providers table in database
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

// ============ Configuration ============
const DB_PATH = path.join(__dirname, '../server/database.sqlite');
const ENV_PATH = path.join(__dirname, '../.env');

// Load .env
function loadEnv() {
    if (!fs.existsSync(ENV_PATH)) {
        console.error('❌ .env file not found!');
        process.exit(1);
    }
    const envContent = fs.readFileSync(ENV_PATH, 'utf8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^["'](.*)["']$/, '$1');
            if (!process.env[key]) {
                process.env[key] = value;
            }
        }
    });
}

// ============ Test Functions ============

async function testOpenAI(apiKey) {
    return new Promise((resolve) => {
        const data = JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'Say OK' }],
            max_tokens: 5
        });

        const options = {
            hostname: 'api.openai.com',
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            timeout: 15000
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve({ success: true, message: 'Connection OK' });
                } else {
                    const err = JSON.parse(body)?.error?.message || `HTTP ${res.statusCode}`;
                    resolve({ success: false, message: err });
                }
            });
        });

        req.on('error', (e) => resolve({ success: false, message: e.message }));
        req.on('timeout', () => { req.destroy(); resolve({ success: false, message: 'Timeout' }); });
        req.write(data);
        req.end();
    });
}

async function testGemini(apiKey) {
    return new Promise((resolve) => {
        const data = JSON.stringify({
            contents: [{ parts: [{ text: 'Say OK' }] }]
        });

        const options = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve({ success: true, message: 'Connection OK' });
                } else {
                    try {
                        const err = JSON.parse(body)?.error?.message || `HTTP ${res.statusCode}`;
                        resolve({ success: false, message: err.substring(0, 80) });
                    } catch {
                        resolve({ success: false, message: `HTTP ${res.statusCode}` });
                    }
                }
            });
        });

        req.on('error', (e) => resolve({ success: false, message: e.message }));
        req.on('timeout', () => { req.destroy(); resolve({ success: false, message: 'Timeout' }); });
        req.write(data);
        req.end();
    });
}

async function testDeepSeek(apiKey) {
    return new Promise((resolve) => {
        const data = JSON.stringify({
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: 'Say OK' }],
            max_tokens: 5
        });

        const options = {
            hostname: 'api.deepseek.com',
            path: '/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            timeout: 15000
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve({ success: true, message: 'Connection OK' });
                } else {
                    try {
                        const err = JSON.parse(body)?.error?.message || JSON.parse(body)?.detail || `HTTP ${res.statusCode}`;
                        resolve({ success: false, message: String(err).substring(0, 80) });
                    } catch {
                        resolve({ success: false, message: `HTTP ${res.statusCode}` });
                    }
                }
            });
        });

        req.on('error', (e) => resolve({ success: false, message: e.message }));
        req.on('timeout', () => { req.destroy(); resolve({ success: false, message: 'Timeout' }); });
        req.write(data);
        req.end();
    });
}

async function testQwen(apiKey) {
    return new Promise((resolve) => {
        const data = JSON.stringify({
            model: 'qwen-turbo',
            messages: [{ role: 'user', content: 'Say OK' }],
            max_tokens: 5
        });

        const options = {
            hostname: 'dashscope-intl.aliyuncs.com',
            path: '/compatible-mode/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            timeout: 15000
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve({ success: true, message: 'Connection OK' });
                } else {
                    try {
                        const parsed = JSON.parse(body);
                        const err = parsed?.error?.message || parsed?.message || `HTTP ${res.statusCode}`;
                        resolve({ success: false, message: String(err).substring(0, 80) });
                    } catch {
                        resolve({ success: false, message: `HTTP ${res.statusCode}` });
                    }
                }
            });
        });

        req.on('error', (e) => resolve({ success: false, message: e.message }));
        req.on('timeout', () => { req.destroy(); resolve({ success: false, message: 'Timeout' }); });
        req.write(data);
        req.end();
    });
}

async function testZAI(apiKey) {
    return new Promise((resolve) => {
        const data = JSON.stringify({
            model: 'glm-4-plus',
            messages: [{ role: 'user', content: 'Say OK' }],
            max_tokens: 5
        });

        const options = {
            hostname: 'open.bigmodel.cn',
            path: '/api/paas/v4/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            timeout: 15000
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve({ success: true, message: 'Connection OK' });
                } else {
                    try {
                        const err = JSON.parse(body)?.error?.message || `HTTP ${res.statusCode}`;
                        resolve({ success: false, message: String(err).substring(0, 80) });
                    } catch {
                        resolve({ success: false, message: `HTTP ${res.statusCode}` });
                    }
                }
            });
        });

        req.on('error', (e) => resolve({ success: false, message: e.message }));
        req.on('timeout', () => { req.destroy(); resolve({ success: false, message: 'Timeout' }); });
        req.write(data);
        req.end();
    });
}

async function testCohere(apiKey) {
    return new Promise((resolve) => {
        const data = JSON.stringify({
            model: 'command-r-plus-08-2024',
            message: 'Say OK'
        });

        const options = {
            hostname: 'api.cohere.ai',
            path: '/v1/chat',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            timeout: 15000
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve({ success: true, message: 'Connection OK' });
                } else {
                    try {
                        const err = JSON.parse(body)?.message || `HTTP ${res.statusCode}`;
                        resolve({ success: false, message: String(err).substring(0, 80) });
                    } catch {
                        resolve({ success: false, message: `HTTP ${res.statusCode}` });
                    }
                }
            });
        });

        req.on('error', (e) => resolve({ success: false, message: e.message }));
        req.on('timeout', () => { req.destroy(); resolve({ success: false, message: 'Timeout' }); });
        req.write(data);
        req.end();
    });
}

async function testNvidia(apiKey) {
    return new Promise((resolve) => {
        const data = JSON.stringify({
            model: 'meta/llama-3.1-8b-instruct',
            messages: [{ role: 'user', content: 'Say OK' }],
            max_tokens: 5
        });

        const options = {
            hostname: 'integrate.api.nvidia.com',
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            timeout: 15000
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve({ success: true, message: 'Connection OK' });
                } else {
                    try {
                        const err = JSON.parse(body)?.detail || JSON.parse(body)?.error?.message || `HTTP ${res.statusCode}`;
                        resolve({ success: false, message: String(err).substring(0, 80) });
                    } catch {
                        resolve({ success: false, message: `HTTP ${res.statusCode}` });
                    }
                }
            });
        });

        req.on('error', (e) => resolve({ success: false, message: e.message }));
        req.on('timeout', () => { req.destroy(); resolve({ success: false, message: 'Timeout' }); });
        req.write(data);
        req.end();
    });
}

// ============ Main ============

async function main() {
    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║       COMPREHENSIVE LLM CONNECTION TEST SUITE         ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');

    loadEnv();

    const tests = [
        { name: 'OpenAI', env: 'OPENAI_API_KEY', fn: testOpenAI },
        { name: 'Google Gemini', env: 'GEMINI_API_KEY', fn: testGemini },
        { name: 'DeepSeek', env: 'DEEPSEEK_API_KEY', fn: testDeepSeek },
        { name: 'Qwen (Alibaba)', env: 'QWEN_API_KEY', fn: testQwen },
        { name: 'Z.AI (Zhipu)', env: 'ZAI_API_KEY', fn: testZAI },
        { name: 'Cohere', env: 'COHERE_API_KEY', fn: testCohere },
        { name: 'Nvidia NIM', env: 'NVIDIA_API_KEY', fn: testNvidia }
    ];

    const results = [];
    
    console.log('Testing providers from .env...\n');

    for (const test of tests) {
        const apiKey = process.env[test.env];
        process.stdout.write(`  ${test.name.padEnd(20)} `);

        if (!apiKey) {
            console.log('⚪ SKIP (no key in .env)');
            results.push({ name: test.name, status: 'skip', message: 'No API key' });
            continue;
        }

        const result = await test.fn(apiKey);
        if (result.success) {
            console.log(`✅ OK`);
            results.push({ name: test.name, status: 'ok', message: result.message });
        } else {
            console.log(`❌ FAIL - ${result.message}`);
            results.push({ name: test.name, status: 'fail', message: result.message });
        }
    }

    // Database check
    console.log('\n─────────────────────────────────────────────────────────');
    console.log('Checking database configuration...\n');

    const db = new sqlite3.Database(DB_PATH);
    
    await new Promise((resolve) => {
        db.all('SELECT provider, name, is_active, is_default FROM llm_providers', [], (err, rows) => {
            if (err) {
                console.log('  ❌ Database error:', err.message);
            } else {
                console.log(`  Found ${rows?.length || 0} providers in database:`);
                (rows || []).forEach(row => {
                    const status = row.is_active ? '✅' : '⚪';
                    const def = row.is_default ? ' (DEFAULT)' : '';
                    console.log(`    ${status} ${row.name}${def}`);
                });
            }
            resolve();
        });
    });

    db.close();

    // Summary
    console.log('\n═══════════════════════════════════════════════════════════');
    const okCount = results.filter(r => r.status === 'ok').length;
    const failCount = results.filter(r => r.status === 'fail').length;
    const skipCount = results.filter(r => r.status === 'skip').length;

    console.log(`SUMMARY: ${okCount} OK | ${failCount} FAILED | ${skipCount} SKIPPED`);
    
    if (failCount > 0) {
        console.log('\n⚠️  Some providers failed. Run: node scripts/auto_repair_llm.cjs');
        process.exit(1);
    } else if (okCount === 0) {
        console.log('\n⚠️  No working providers! Check your .env file.');
        process.exit(1);
    } else {
        console.log('\n✅ All tested providers are working!');
        process.exit(0);
    }
}

main().catch(console.error);

