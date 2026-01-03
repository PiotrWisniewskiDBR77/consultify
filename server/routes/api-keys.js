/**
 * API Keys Management Routes
 * 
 * Enterprise API key management for external integrations
 * Features:
 * - Create API keys with scopes and expiration
 * - List and manage keys
 * - Revoke keys
 * - Rate limiting per key
 */

const express = require('express');
const router = express.Router();
const db = require('../database');
const verifyToken = require('../middleware/authMiddleware');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Apply auth middleware to all routes
router.use(verifyToken);

// Available scopes for API keys
const AVAILABLE_SCOPES = [
    { id: 'read', name: 'Read', description: 'Read access to data' },
    { id: 'write', name: 'Write', description: 'Create and update data' },
    { id: 'delete', name: 'Delete', description: 'Delete data' },
    { id: 'admin', name: 'Admin', description: 'Administrative operations' },
    { id: 'ai', name: 'AI', description: 'AI and LLM operations' },
    { id: 'export', name: 'Export', description: 'Export data' },
    { id: 'projects', name: 'Projects', description: 'Project management' },
    { id: 'assessments', name: 'Assessments', description: 'Assessment operations' }
];

/**
 * Helper: Generate secure API key
 */
function generateApiKey() {
    // Format: ck_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
    const prefix = 'ck_live_';
    const randomPart = crypto.randomBytes(24).toString('hex');
    return prefix + randomPart;
}

/**
 * Helper: Hash API key for storage
 */
function hashApiKey(key) {
    return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * GET /api/api-keys
 * List all API keys for organization
 */
router.get('/', async (req, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const userRole = req.user?.role;

        if (!organizationId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Only Admin/Owner can view API keys
        if (!['ADMIN', 'OWNER', 'SUPERADMIN'].includes(userRole)) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const keys = await new Promise((resolve, reject) => {
            db.all(
                `SELECT ak.id, ak.name, ak.description, ak.key_prefix, ak.scopes,
                        ak.expires_at, ak.last_used_at, ak.last_used_ip,
                        ak.rate_limit_per_hour, ak.created_at, ak.revoked_at,
                        u.first_name, u.last_name, u.email as created_by_email
                 FROM api_keys ak
                 LEFT JOIN users u ON ak.user_id = u.id
                 WHERE ak.organization_id = ?
                 ORDER BY ak.created_at DESC`,
                [organizationId],
                (err, rows) => err ? reject(err) : resolve(rows || [])
            );
        });

        res.json({
            success: true,
            keys: keys.map(k => ({
                id: k.id,
                name: k.name,
                description: k.description,
                keyPrefix: k.key_prefix,
                scopes: k.scopes ? JSON.parse(k.scopes) : ['read'],
                expiresAt: k.expires_at,
                lastUsedAt: k.last_used_at,
                lastUsedIp: k.last_used_ip,
                rateLimitPerHour: k.rate_limit_per_hour,
                createdAt: k.created_at,
                createdBy: k.first_name ? `${k.first_name} ${k.last_name}` : k.created_by_email,
                isRevoked: !!k.revoked_at,
                revokedAt: k.revoked_at
            }))
        });
    } catch (err) {
        console.error('[API Keys] List error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/api-keys/scopes
 * Get available scopes
 */
router.get('/scopes', (req, res) => {
    res.json({
        success: true,
        scopes: AVAILABLE_SCOPES
    });
});

/**
 * POST /api/api-keys
 * Create a new API key
 */
router.post('/', async (req, res) => {
    try {
        const userId = req.user?.id;
        const organizationId = req.user?.organizationId;
        const userRole = req.user?.role;

        if (!organizationId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!['ADMIN', 'OWNER', 'SUPERADMIN'].includes(userRole)) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const {
            name,
            description,
            scopes = ['read'],
            expiresAt,
            rateLimitPerHour = 1000
        } = req.body;

        if (!name || name.trim().length < 2) {
            return res.status(400).json({ error: 'Name is required (min 2 characters)' });
        }

        // Validate scopes
        const validScopes = scopes.filter(s => AVAILABLE_SCOPES.some(as => as.id === s));
        if (validScopes.length === 0) {
            return res.status(400).json({ error: 'At least one valid scope is required' });
        }

        // Generate the actual API key
        const apiKey = generateApiKey();
        const keyHash = hashApiKey(apiKey);
        const keyPrefix = apiKey.substring(0, 12) + '...'; // Show first 12 chars

        const keyId = uuidv4();

        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO api_keys (
                    id, organization_id, user_id, name, description,
                    key_prefix, key_hash, scopes, expires_at,
                    rate_limit_per_hour, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                [
                    keyId,
                    organizationId,
                    userId,
                    name.trim(),
                    description || null,
                    keyPrefix,
                    keyHash,
                    JSON.stringify(validScopes),
                    expiresAt || null,
                    rateLimitPerHour
                ],
                (err) => err ? reject(err) : resolve()
            );
        });

        // Return the FULL key only once - user must save it now
        res.json({
            success: true,
            message: 'API key created. Save this key now - it won\'t be shown again!',
            key: {
                id: keyId,
                name: name.trim(),
                apiKey: apiKey, // Full key - only shown once!
                keyPrefix,
                scopes: validScopes,
                expiresAt,
                rateLimitPerHour,
                createdAt: new Date().toISOString()
            }
        });
    } catch (err) {
        console.error('[API Keys] Create error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT /api/api-keys/:id
 * Update API key (name, description, scopes, rate limit)
 */
router.put('/:id', async (req, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const userRole = req.user?.role;
        const { id } = req.params;

        if (!['ADMIN', 'OWNER', 'SUPERADMIN'].includes(userRole)) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Verify key belongs to organization
        const key = await new Promise((resolve, reject) => {
            db.get(
                'SELECT id FROM api_keys WHERE id = ? AND organization_id = ?',
                [id, organizationId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (!key) {
            return res.status(404).json({ error: 'API key not found' });
        }

        const { name, description, scopes, rateLimitPerHour, expiresAt } = req.body;

        const updates = [];
        const params = [];

        if (name) {
            updates.push('name = ?');
            params.push(name.trim());
        }
        if (description !== undefined) {
            updates.push('description = ?');
            params.push(description);
        }
        if (scopes) {
            updates.push('scopes = ?');
            params.push(JSON.stringify(scopes));
        }
        if (rateLimitPerHour) {
            updates.push('rate_limit_per_hour = ?');
            params.push(rateLimitPerHour);
        }
        if (expiresAt !== undefined) {
            updates.push('expires_at = ?');
            params.push(expiresAt);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        params.push(id);

        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE api_keys SET ${updates.join(', ')} WHERE id = ?`,
                params,
                (err) => err ? reject(err) : resolve()
            );
        });

        res.json({ success: true, message: 'API key updated' });
    } catch (err) {
        console.error('[API Keys] Update error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/api-keys/:id
 * Revoke (soft delete) an API key
 */
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user?.id;
        const organizationId = req.user?.organizationId;
        const userRole = req.user?.role;
        const { id } = req.params;

        if (!['ADMIN', 'OWNER', 'SUPERADMIN'].includes(userRole)) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Verify key belongs to organization
        const key = await new Promise((resolve, reject) => {
            db.get(
                'SELECT id, revoked_at FROM api_keys WHERE id = ? AND organization_id = ?',
                [id, organizationId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (!key) {
            return res.status(404).json({ error: 'API key not found' });
        }

        if (key.revoked_at) {
            return res.status(400).json({ error: 'API key is already revoked' });
        }

        // Soft delete - set revoked_at
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE api_keys SET revoked_at = datetime('now'), revoked_by = ? WHERE id = ?`,
                [userId, id],
                (err) => err ? reject(err) : resolve()
            );
        });

        res.json({ success: true, message: 'API key revoked' });
    } catch (err) {
        console.error('[API Keys] Revoke error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/api-keys/:id/regenerate
 * Regenerate an API key (creates new key, revokes old)
 */
router.post('/:id/regenerate', async (req, res) => {
    try {
        const userId = req.user?.id;
        const organizationId = req.user?.organizationId;
        const userRole = req.user?.role;
        const { id } = req.params;

        if (!['ADMIN', 'OWNER', 'SUPERADMIN'].includes(userRole)) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Get existing key details
        const existingKey = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM api_keys WHERE id = ? AND organization_id = ? AND revoked_at IS NULL',
                [id, organizationId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (!existingKey) {
            return res.status(404).json({ error: 'API key not found or already revoked' });
        }

        // Generate new key
        const newApiKey = generateApiKey();
        const newKeyHash = hashApiKey(newApiKey);
        const newKeyPrefix = newApiKey.substring(0, 12) + '...';

        // Update with new key
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE api_keys SET 
                    key_hash = ?, key_prefix = ?, 
                    created_at = datetime('now')
                 WHERE id = ?`,
                [newKeyHash, newKeyPrefix, id],
                (err) => err ? reject(err) : resolve()
            );
        });

        res.json({
            success: true,
            message: 'API key regenerated. Save this key now - it won\'t be shown again!',
            apiKey: newApiKey,
            keyPrefix: newKeyPrefix
        });
    } catch (err) {
        console.error('[API Keys] Regenerate error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * Middleware: Validate API key for external requests
 * This can be used by other routes to authenticate via API key
 */
async function validateApiKey(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ck_')) {
            return next(); // Not an API key, continue to next auth method
        }

        const apiKey = authHeader.replace('Bearer ', '');
        const keyHash = hashApiKey(apiKey);

        const key = await new Promise((resolve, reject) => {
            db.get(
                `SELECT ak.*, o.id as org_id, o.name as org_name
                 FROM api_keys ak
                 JOIN organizations o ON ak.organization_id = o.id
                 WHERE ak.key_hash = ? AND ak.revoked_at IS NULL`,
                [keyHash],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (!key) {
            return res.status(401).json({ error: 'Invalid API key' });
        }

        // Check expiration
        if (key.expires_at && new Date(key.expires_at) < new Date()) {
            return res.status(401).json({ error: 'API key has expired' });
        }

        // Update last used
        db.run(
            'UPDATE api_keys SET last_used_at = datetime(\'now\'), last_used_ip = ? WHERE id = ?',
            [req.ip, key.id]
        );

        // Attach key info to request
        req.apiKey = {
            id: key.id,
            organizationId: key.organization_id,
            scopes: JSON.parse(key.scopes || '["read"]'),
            rateLimitPerHour: key.rate_limit_per_hour
        };
        req.organizationId = key.organization_id;

        next();
    } catch (err) {
        console.error('[API Keys] Validation error:', err);
        res.status(500).json({ error: 'API key validation failed' });
    }
}

// Export middleware for use by other routes
router.validateApiKey = validateApiKey;

module.exports = router;





