
const fs = require('fs');
const https = require('https');
const path = require('path');
const jwt = require('jsonwebtoken'); // Available in node_modules
const sqlite3 = require('sqlite3').verbose(); // Added for DB checks

// Load .env manually
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
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

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function logResult(provider, success, message) {
    if (success) {
        console.log(`${GREEN}[✓] ${provider}: SUCCESS${RESET} - ${message}`);
    } else {
        console.log(`${RED}[✗] ${provider}: FAILED${RESET} - ${message}`);
    }
}

// Low-level HTTPS request helper
function makeRequest(hostname, path, method, body, headers = {}) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname,
            port: 443,
            path,
            method,
            headers: {
                'User-Agent': 'Node/TestScript',
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({ statusCode: res.statusCode, body: data });
            });
        });

        req.on('error', (e) => reject(e));
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

function generateValues(id) {
    const NOW = Date.now();
    const ONE_HOUR = 3600 * 1000;
    const exp = NOW + ONE_HOUR;
    const timestamp = NOW;
    return { id, exp, timestamp };
}

function generateZaiToken(apiKey) {
    try {
        const [id, secret] = apiKey.split('.');
        if (!id || !secret) throw new Error('Invalid Key Format');

        const payload = {
            api_key: id,
            exp: Date.now() + 3600 * 1000,
            timestamp: Date.now()
        };

        // Zhipu requires specific header alghorithm usually but standard JWT lib handles HS256 by default
        return jwt.sign(payload, secret, { algorithm: 'HS256', header: { alg: 'HS256', sign_type: 'SIGN' } });
    } catch (e) {
        return null;
    }
}

async function testOpenAI() {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return logResult('OpenAI', false, 'Missing API Key');

    try {
        const res = await makeRequest('api.openai.com', '/v1/models', 'GET', null, {
            'Authorization': `Bearer ${key}`
        });
        if (res.statusCode === 200) {
            logResult('OpenAI', true, 'Connection established');
        } else {
            logResult('OpenAI', false, `Status ${res.statusCode}`);
        }
    } catch (e) {
        logResult('OpenAI', false, e.message);
    }
}

async function testGemini() {
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!key) return logResult('Gemini', false, 'Missing API Key');

    try {
        const path = `/v1beta/models?key=${key}`;
        const res = await makeRequest('generativelanguage.googleapis.com', path, 'GET');

        if (res.statusCode === 200) {
            logResult('Gemini', true, 'Connection established');
        } else {
            logResult('Gemini', false, `Status ${res.statusCode}`);
        }
    } catch (e) {
        logResult('Gemini', false, e.message);
    }
}

async function testDeepSeek() {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) return logResult('DeepSeek', false, 'Missing API Key');

    try {
        const res = await makeRequest('api.deepseek.com', '/models', 'GET', null, {
            'Authorization': `Bearer ${key}`
        });
        if (res.statusCode === 200) {
            logResult('DeepSeek', true, 'Connection established');
        } else {
            logResult('DeepSeek', false, `Status ${res.statusCode}`);
        }
    } catch (e) {
        logResult('DeepSeek', false, e.message);
    }
}

async function testQwen() {
    const key = process.env.QWEN_API_KEY;
    if (!key) return logResult('Qwen', false, 'Missing API Key');
    logResult('Qwen', true, 'Key present (Visual check only)');
}

async function testZAI() {
    const key = process.env.ZAI_API_KEY;
    if (!key) return logResult('Z.AI (Zhipu)', false, 'Missing API Key');

    const token = generateZaiToken(key);
    if (!token) return logResult('Z.AI (Zhipu)', false, 'Failed to generate JWT (Invalid Key Format?)');

    try {
        // Zhipu V4 API endpoint
        const res = await makeRequest('open.bigmodel.cn', '/api/paas/v4/chat/completions', 'POST', {
            model: "glm-4-plus",
            messages: [{ role: "user", content: "pong" }]
        }, {
            'Authorization': `Bearer ${token}`
        });

        if (res.statusCode === 200) {
            logResult('Z.AI (Zhipu)', true, 'Connection established');
        } else {
            // 401/403 usually means auth failed
            let body;
            try { body = JSON.parse(res.body || '{}'); } catch (e) { body = res.body; }
            logResult('Z.AI (Zhipu)', false, `Status ${res.statusCode} - ${body.error?.message || JSON.stringify(body)}`);
        }
    } catch (e) {
        logResult('Z.AI (Zhipu)', false, e.message);
    }
}

async function testCohere() {
    const key = process.env.COHERE_API_KEY;
    if (!key) return logResult('Cohere', false, 'Missing API Key');

    try {
        const res = await makeRequest('api.cohere.ai', '/v1/models', 'GET', null, {
            'Authorization': `Bearer ${key}`,
            'Aborted': 'false'
        });

        if (res.statusCode === 200) {
            logResult('Cohere', true, 'Connection established');
        } else {
            logResult('Cohere', false, `Status ${res.statusCode}`);
        }
    } catch (e) {
        logResult('Cohere', false, e.message);
    }
}


async function testNvidia() {
    const key = process.env.NVIDIA_API_KEY;
    if (!key) return logResult('Nvidia', false, 'Missing API Key');

    try {
        const res = await makeRequest('integrate.api.nvidia.com', '/v1/models', 'GET', null, {
            'Authorization': `Bearer ${key}`
        });

        if (res.statusCode === 200) {
            logResult('Nvidia', true, 'Connection established');
        } else {
            logResult('Nvidia', false, `Status ${res.statusCode}`);
        }
    } catch (e) {
        logResult('Nvidia', false, e.message);
    }
}

// --- SYSTEM VERIFICATION HELPERS ---

function logSystem(msg, success) {
    if (success === true) console.log(`${GREEN}[✓] SYSTEM: ${msg}${RESET}`);
    else if (success === false) console.log(`${RED}[✗] SYSTEM: ${msg}${RESET}`);
    else console.log(`[i] SYSTEM: ${msg}`);
}

async function verifySystem() {
    console.log('\n--- VERIFYING SYSTEM INTEGRITY (SuperAdmin / Audit) ---\n');

    const DB_PATH = path.join(__dirname, '../server/consultify.db');
    if (!fs.existsSync(DB_PATH)) {
        return logSystem('Database file missing!', false);
    }

    const db = new sqlite3.Database(DB_PATH);

    const runQuery = (query, params = []) => new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });

    try {
        // 1. Verify SuperAdmin Visibility via DB
        const providers = await runQuery('SELECT * FROM llm_providers');
        if (providers.length > 0) {
            logSystem(`SuperAdmin has ${providers.length} configured providers available in DB.`, true);
            const providerNames = providers.map(p => p.provider).join(', ');
            console.log(`    Providers: ${providerNames}`);
        } else {
            logSystem('No providers check failed - DB table empty.', false);
        }

        // 2. Verify Audit Log Table Schema
        const auditCols = await runQuery("PRAGMA table_info(ai_audit_logs)");
        const colNames = auditCols.map(c => c.name);
        const required = ['model', 'tokens_used', 'cost_usd'];
        const missing = required.filter(c => !colNames.includes(c));

        if (missing.length === 0) {
            logSystem('Audit Log Audit (ai_audit_logs) schema is CORRECT.', true);
        } else {
            logSystem(`Audit Log Schema Incorrect. Missing: ${missing.join(', ')}`, false);
        }

        // 3. Verify Default Settings
        const defaults = await runQuery("SELECT * FROM llm_providers WHERE is_default = 1");
        if (defaults.length > 0) {
            logSystem(`System Default AI is set to: ${defaults[0].name}`, true);
        } else {
            logSystem('System Default AI is NOT set (Warning for Settings UI).', false);
        }

    } catch (e) {
        logSystem(`Verification Error: ${e.message}`, false);
    } finally {
        db.close();
    }
}

async function runValidation() {
    // 1. API Keys
    console.log('--- VALIDATING LLM KEYS ---\n');
    await testOpenAI();
    await testGemini();
    await testDeepSeek();
    await testQwen();
    await testZAI();
    await testCohere();
    await testNvidia();
    console.log('\n---------------------------');

    // 2. System Check
    await verifySystem();
}

runValidation();
