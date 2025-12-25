const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const verifyToken = require('../middleware/authMiddleware');

// Helper: Run DB Run
const dbRun = (query, params) => new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
        if (err) reject(err);
        else resolve(this);
    });
});

// Helper: Run DB All
const dbAll = (query, params) => new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

// Helper: Run DB Get
const dbGet = (query, params) => new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

// GET /api/llm/diagnose - Self-diagnostic and auto-repair endpoint
router.get('/diagnose', async (req, res) => {
    const diagnostics = {
        timestamp: new Date().toISOString(),
        checks: [],
        repairs: [],
        status: 'OK'
    };

    try {
        // 1. Check if llm_providers table exists
        const tableCheck = await new Promise((resolve) => {
            db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='llm_providers'", [], (err, row) => {
                resolve(row ? true : false);
            });
        });

        if (!tableCheck) {
            diagnostics.checks.push({ name: 'llm_providers_table', status: 'MISSING' });
            diagnostics.status = 'REPAIRED';

            // Auto-repair: Create table
            await dbRun(`CREATE TABLE IF NOT EXISTS llm_providers(
                id TEXT PRIMARY KEY,
                name TEXT,
                provider TEXT,
                api_key TEXT,
                endpoint TEXT,
                model_id TEXT,
                cost_per_1k REAL DEFAULT 0,
                input_cost_per_1k REAL DEFAULT 0,
                output_cost_per_1k REAL DEFAULT 0,
                markup_multiplier REAL DEFAULT 1.0,
                is_active INTEGER DEFAULT 1,
                is_default INTEGER DEFAULT 0,
                visibility TEXT DEFAULT 'admin'
            )`);
            diagnostics.repairs.push('Created llm_providers table');
        } else {
            diagnostics.checks.push({ name: 'llm_providers_table', status: 'OK' });
        }

        // 2. Check if any providers exist
        const providerCount = await dbGet("SELECT COUNT(*) as count FROM llm_providers");
        diagnostics.checks.push({ name: 'providers_count', value: providerCount?.count || 0 });

        if (!providerCount || providerCount.count === 0) {
            diagnostics.status = 'REPAIRED';

            // Auto-repair: Add default OpenAI provider (placeholder - user needs to add real key)
            const defaultId = uuidv4();
            await dbRun(`INSERT INTO llm_providers (id, name, provider, api_key, endpoint, model_id, is_active, is_default, visibility)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [defaultId, 'GPT-4o (Default)', 'openai', 'sk-REPLACE-WITH-YOUR-KEY', 'https://api.openai.com/v1', 'gpt-4o', 1, 1, 'public']
            );
            diagnostics.repairs.push('Added default OpenAI provider (needs API key configuration)');
        }

        // 3. Check active providers
        const activeProviders = await dbAll("SELECT id, name, provider, is_active, visibility FROM llm_providers WHERE is_active = 1");
        diagnostics.checks.push({ name: 'active_providers', value: activeProviders?.length || 0, details: activeProviders });

        // 4. Check if any public providers exist
        const publicProviders = await dbAll("SELECT id, name FROM llm_providers WHERE visibility = 'public' AND is_active = 1");
        diagnostics.checks.push({ name: 'public_providers', value: publicProviders?.length || 0 });

        if (publicProviders?.length === 0 && activeProviders?.length > 0) {
            // Make first active provider public
            await dbRun("UPDATE llm_providers SET visibility = 'public' WHERE id = ?", [activeProviders[0].id]);
            diagnostics.repairs.push(`Made provider "${activeProviders[0].name}" public`);
            diagnostics.status = 'REPAIRED';
        }

        // 5. Test connection to first active provider
        if (activeProviders && activeProviders.length > 0) {
            const testProvider = await dbGet("SELECT * FROM llm_providers WHERE is_active = 1 LIMIT 1");
            if (testProvider && testProvider.api_key && !testProvider.api_key.includes('REPLACE')) {
                diagnostics.checks.push({ name: 'api_key_configured', status: 'OK' });
            } else {
                diagnostics.checks.push({ name: 'api_key_configured', status: 'NEEDS_CONFIGURATION', message: 'API key needs to be set in Admin > LLM Providers' });
                diagnostics.status = diagnostics.status === 'OK' ? 'NEEDS_CONFIG' : diagnostics.status;
            }
        }

        res.json(diagnostics);
    } catch (err) {
        console.error('[LLM Diagnose] Error:', err);
        diagnostics.status = 'ERROR';
        diagnostics.error = err.message;
        res.status(500).json(diagnostics);
    }
});

// GET /api/llm/providers/public - Get providers visible to users (PUBLIC)
router.get('/providers/public', async (req, res) => {
    try {
        const providers = await dbAll(
            "SELECT id, name, provider, model_id, endpoint FROM llm_providers WHERE visibility = 'public' AND is_active = 1 ORDER BY name ASC"
        );
        res.json(providers || []);
    } catch (err) {
        // If table doesn't exist, return empty array instead of error
        console.error('[LLM] providers/public error:', err.message);
        res.json([]);
    }
});

router.use(verifyToken);

// GET /api/llm/providers
router.get('/providers', async (req, res) => {
    try {
        const providers = await dbAll("SELECT * FROM llm_providers ORDER BY name ASC");
        res.json(providers);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch providers' });
    }
});

// POST /api/llm/providers
router.post('/providers', async (req, res) => {
    const { name, provider, api_key, endpoint, model_id, cost_per_1k, input_cost_per_1k, output_cost_per_1k, markup_multiplier, is_active, visibility } = req.body;
    try {
        const id = uuidv4();
        await dbRun(`
            INSERT INTO llm_providers (id, name, provider, api_key, endpoint, model_id, cost_per_1k, input_cost_per_1k, output_cost_per_1k, markup_multiplier, is_active, visibility)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id, name, provider, api_key, endpoint, model_id,
            cost_per_1k || 0,
            input_cost_per_1k || 0,
            output_cost_per_1k || 0,
            markup_multiplier || 1.0,
            is_active ? 1 : 0,
            visibility || 'admin'
        ]);

        res.json({ id, message: 'Provider added' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to add provider' });
    }
});

// PUT /api/llm/providers/:id
router.put('/providers/:id', async (req, res) => {
    const { name, api_key, endpoint, model_id, cost_per_1k, input_cost_per_1k, output_cost_per_1k, markup_multiplier, is_active, visibility } = req.body;
    const { id } = req.params;
    try {
        await dbRun(`
            UPDATE llm_providers 
            SET name = ?, api_key = ?, endpoint = ?, model_id = ?, cost_per_1k = ?, input_cost_per_1k = ?, output_cost_per_1k = ?, markup_multiplier = ?, is_active = ?, visibility = ?
            WHERE id = ?
        `, [
            name, api_key, endpoint, model_id,
            cost_per_1k,
            input_cost_per_1k || 0,
            output_cost_per_1k || 0,
            markup_multiplier || 1.0,
            is_active ? 1 : 0,
            visibility,
            id
        ]);

        res.json({ message: 'Provider updated' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update provider' });
    }
});

// DELETE /api/llm/providers/:id
router.delete('/providers/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await dbRun("DELETE FROM llm_providers WHERE id = ?", [id]);
        res.json({ message: 'Provider deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete provider' });
    }
});


// POST /api/llm/test-ollama - Test Ollama connection (Legacy/Specific)
router.post('/test-ollama', async (req, res) => {
    return res.status(400).json({ success: false, error: 'Ollama integration is disabled.' });
});

// POST /api/llm/test - Generic Test Connection
router.post('/test', async (req, res) => {
    try {
        const config = req.body;
        // Import AiService dynamically to avoid circular dependencies if any, or just require at top if safe.
        // Assuming AiService is in ../services/aiService
        const AiService = require('../services/aiService');

        const result = await AiService.testProviderConnection(config);

        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (err) {
        console.error('Test connection error:', err);
        res.status(500).json({ success: false, error: 'Internal server error during test' });
    }
});

// GET /api/llm/ollama-models - List available Ollama models
// GET /api/llm/ollama-models - List available Ollama models
router.get('/ollama-models', async (req, res) => {
    res.json([]);
});

// GET /api/llm/organization-config/:orgId
router.get('/organization-config/:orgId', async (req, res) => {
    const { orgId } = req.params;
    try {
        // Get current selection
        const org = await new Promise((resolve, reject) => {
            db.get("SELECT active_llm_provider_id FROM organizations WHERE id = ?", [orgId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        // Get available options (all active providers)
        // Admin should be able to see all active providers (even if visibility is 'admin' or 'beta' if they are the org admin?? 
        // OR maybe superadmin decides which are 'public' for org admins to pick.
        // Let's assume Org Admin can pick from 'public' and 'beta' and 'admin' (if they are superadmin?). 
        // For simplicity, let's allow Org Admin to pick from ANY active provider for now, or maybe restrict 'admin' visibility to SuperAdmins only.
        // Request says "Superadmin adds... Admin decides". Implies Admin sees what Superadmin added.
        // So we return all ACTIVE providers.
        const providers = await dbAll("SELECT id, name, provider, model_id FROM llm_providers WHERE is_active = 1 ORDER BY name ASC");

        res.json({
            activeProviderId: org ? org.active_llm_provider_id : null,
            availableProviders: providers
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch organization config' });
    }
});

// POST /api/llm/organization-config/:orgId
router.post('/organization-config/:orgId', async (req, res) => {
    const { orgId } = req.params;
    const { providerId } = req.body; // Can be null to reset to system default

    try {
        await dbRun("UPDATE organizations SET active_llm_provider_id = ? WHERE id = ?", [providerId, orgId]);
        res.json({ message: 'Organization LLM updated', providerId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update configuration' });
    }
});

module.exports = router;
