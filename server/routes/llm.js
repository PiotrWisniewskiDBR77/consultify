const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

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

// GET /api/llm/providers/public - Get providers visible to users
router.get('/providers/public', async (req, res) => {
    try {
        const providers = await dbAll(
            "SELECT id, name, provider, model_id, endpoint FROM llm_providers WHERE visibility = 'public' AND is_active = 1 ORDER BY name ASC"
        );
        res.json(providers);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch public providers' });
    }
});

// POST /api/llm/test-ollama - Test Ollama connection (Legacy/Specific)
router.post('/test-ollama', async (req, res) => {
    const { endpoint } = req.body;
    const ollamaUrl = endpoint || 'http://localhost:11434';

    try {
        const response = await fetch(`${ollamaUrl}/api/tags`);
        if (!response.ok) {
            return res.status(400).json({ success: false, error: 'Failed to connect to Ollama' });
        }
        const data = await response.json();
        const models = data.models || [];
        res.json({
            success: true,
            message: `Connected! Found ${models.length} models.`,
            models: models.map(m => ({ name: m.name, size: m.size }))
        });
    } catch (err) {
        res.status(400).json({ success: false, error: `Connection failed: ${err.message}` });
    }
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
router.get('/ollama-models', async (req, res) => {
    const endpoint = req.query.endpoint || 'http://localhost:11434';

    try {
        const response = await fetch(`${endpoint}/api/tags`);
        if (!response.ok) {
            return res.status(400).json({ error: 'Failed to fetch Ollama models' });
        }
        const data = await response.json();
        res.json(data.models || []);
    } catch (err) {
        res.status(400).json({ error: `Failed to connect: ${err.message}` });
    }
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
