const db = require('../database');

/**
 * SystemIntegrity Service
 * 
 * "The Doctor" for the application.
 * Checks vital signs at startup to prevent "Silent Failures" and "Data Disconnections".
 */
const SystemIntegrity = {

    check: async () => {
        console.log('\n🏥 [SystemIntegrity] Starting Vitals Check...');
        const issues = [];

        try {
            // 1. Check Database Semantic Anchor (Are we in the RIGHT database?)
            const dbr77 = await new Promise((resolve) => {
                db.get("SELECT id, name FROM organizations WHERE name LIKE '%DBR77%' OR id = 'dbr77'", [], (err, row) => {
                    if (err) resolve(null);
                    else resolve(row);
                });
            });

            if (!dbr77) {
                issues.push({
                    type: 'CRITICAL',
                    component: 'DATABASE',
                    message: "Anchor Tenant 'DBR77' NOT FOUND. You might be connected to an empty or wrong database."
                });
            } else {
                console.log(`✅ [SystemIntegrity] Database Anchor Found: ${dbr77.name} (${dbr77.id})`);
            }

            // 2. Check LLM Configuration (Are keys real?)
            const providers = await new Promise((resolve) => {
                db.all("SELECT provider, api_key FROM llm_providers WHERE is_active = 1", [], (err, rows) => {
                    if (err) resolve([]);
                    else resolve(rows);
                });
            });

            if (providers.length === 0) {
                issues.push({ type: 'WARNING', component: 'LLM', message: "No Active LLM Providers found." });
            } else {
                let validLLMs = 0;
                providers.forEach(p => {
                    if (!p.api_key || p.api_key.includes('placeholder') || p.api_key.includes('sk-ant-xxx')) {
                        issues.push({
                            type: 'WARNING',
                            component: 'LLM',
                            message: `Provider '${p.provider}' has a MOCK/PLACEHOLDER API Key.`
                        });
                    } else {
                        validLLMs++;
                    }
                });
                if (validLLMs > 0) console.log(`✅ [SystemIntegrity] Found ${validLLMs} Valid LLM Providers.`);
            }

            // 3. Check Redis (Is Queueing operational?)
            // We'll trust the main app logs for connection errors, but strictly:
            if (process.env.MOCK_REDIS === 'true') {
                console.log(`⚠️ [SystemIntegrity] Redis is MOCKED. Async AI tasks will be simulated.`);
            }

        } catch (error) {
            issues.push({ type: 'CRITICAL', component: 'SYSTEM', message: `Integrity Check Failed: ${error.message}` });
        }

        // REPORT CARD
        if (issues.length > 0) {
            console.log('\n🚨 [SystemIntegrity] ISSUES DETECTED:');
            issues.forEach(i => {
                const color = i.type === 'CRITICAL' ? '\x1b[31m' : '\x1b[33m'; // Red or Yellow
                console.log(`${color}[${i.type}] ${i.component}: ${i.message}\x1b[0m`);
            });
            console.log('\n');

            // Optional: Exit on CRITICAL?
            // if (issues.some(i => i.type === 'CRITICAL')) process.exit(1); 
        } else {
            console.log('💚 [SystemIntegrity] System Looks Healthy.\n');
        }
    }
};

module.exports = SystemIntegrity;
