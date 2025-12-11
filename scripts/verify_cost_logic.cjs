
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, '../server/consultify.db');
const db = new sqlite3.Database(dbPath);

async function verifyCosts() {
    console.log('Verifying Cost Logic...');

    // 1. Insert a dummy provider with cost
    await new Promise((resolve, reject) => {
        db.run(`
            INSERT OR REPLACE INTO llm_providers (id, name, provider, model_id, cost_per_1k, is_active)
            VALUES ('test-provider', 'Test GPT', 'openai', 'gpt-4-test', 0.03, 1)
        `, (err) => err ? reject(err) : resolve());
    });
    console.log('Inserted test provider.');

    // 2. Insert dummy usage record
    const metadata = JSON.stringify({ llmProvider: 'openai', modelUsed: 'openai:gpt-4-test' });
    await new Promise((resolve, reject) => {
        db.run(`
            INSERT INTO usage_records (organization_id, user_id, type, amount, metadata, recorded_at)
            VALUES ('test-org', 'test-user', 'token', 1000, ?, datetime('now'))
        `, [metadata], (err) => err ? reject(err) : resolve());
    });
    console.log('Inserted test usage record.');

    // 3. Import UsageService (generic mock or direct require if possible)
    // We need to run this in context of server.
    // Simulating the query logic from UsageService.getOperationalCosts

    // Default to last 30 days
    const end = new Date();
    const start = new Date(new Date().setDate(end.getDate() - 30));

    const query = `
        SELECT 
            u.metadata,
            SUM(u.amount) as total_tokens
        FROM usage_records u
        WHERE u.type = 'token' 
        AND u.recorded_at >= ? 
        AND u.recorded_at <= ?
        GROUP BY u.metadata
    `;

    db.all(query, [start.toISOString(), end.toISOString()], async (err, rows) => {
        if (err) {
            console.error('Query failed:', err);
            return;
        }

        console.log('Raw Rows:', rows);

        // Fetch providers
        const providers = await new Promise((res, rej) => {
            db.all("SELECT provider, model_id, cost_per_1k FROM llm_providers", (e, r) => e ? rej(e) : res(r));
        });

        const aggregated = {};
        let totalCost = 0;

        for (const row of rows) {
            let meta = {};
            try {
                meta = JSON.parse(row.metadata || '{}');
            } catch (e) { continue; }

            const provider = meta.llmProvider || 'unknown';
            const model = meta.modelUsed || 'unknown';

            // Filter for our test model to verify logic
            if (model !== 'openai:gpt-4-test') continue;

            console.log(`Processing test row: provider=${provider}, model=${model}, tokens=${row.total_tokens}`);

            let cleanModelId = model.includes(':') ? model.split(':')[1] : model;

            const matchedProvider = providers.find(p =>
                (p.provider === provider && p.model_id === cleanModelId) ||
                (`${p.provider}:${p.model_id}` === model)
            );

            if (matchedProvider) {
                console.log('Matched Provider:', matchedProvider);
                const cost = (row.total_tokens / 1000) * matchedProvider.cost_per_1k;
                console.log(`Calculated Cost: ${cost} (Expected: 0.03)`);

                if (Math.abs(cost - 0.03) < 0.0001) {
                    console.log('SUCCESS: Cost calculation verified.');
                } else {
                    console.error('FAILURE: Cost calculation incorrect.');
                }
            } else {
                console.error('FAILURE: Could not match provider.');
            }
        }
    });
}

verifyCosts();
