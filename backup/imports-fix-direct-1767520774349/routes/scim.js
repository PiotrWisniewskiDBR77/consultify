/**
 * SCIM 2.0 Routes
 * 
 * Implements SCIM 2.0 protocol endpoints
 * RFC 7643 (Core Schema) and RFC 7644 (Protocol)
 * 
 * Endpoints:
 * - GET /ServiceProviderConfig
 * - GET /Schemas
 * - GET /ResourceTypes
 * - GET /Users
 * - POST /Users
 * - GET /Users/:id
 * - PUT /Users/:id
 * - PATCH /Users/:id
 * - DELETE /Users/:id
 * 
 * Token Management (requires admin auth):
 * - GET /tokens
 * - POST /tokens
 * - DELETE /tokens/:id
 */

import express from 'express';
const router = express.Router();
import * as scimServiceModule from '../services/scimService.js';
const scimService = scimServiceModule.default || scimServiceModule;
import verifyToken from '../middleware/authMiddleware.js';
import { requireRole  } from '../middleware/rbac.js';

// ====== SCIM TOKEN AUTHENTICATION MIDDLEWARE ======

/**
 * Authenticate SCIM requests using bearer token
 */
const scimAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json(scimService.createErrorResponse(
                401, 'invalidAuth', 'Bearer token required'
            ));
        }

        const token = authHeader.replace('Bearer ', '');
        const tokenInfo = await scimService.validateToken(token);

        if (!tokenInfo) {
            return res.status(401).json(scimService.createErrorResponse(
                401, 'invalidAuth', 'Invalid or expired token'
            ));
        }

        req.scimToken = tokenInfo;
        req.organizationId = tokenInfo.organizationId;
        next();
    } catch (error) {
        console.error('[SCIM] Auth error:', error);
        res.status(500).json(scimService.createErrorResponse(
            500, 'internal', 'Authentication failed'
        ));
    }
};

/**
 * Check if token has required scope
 */
const requireScope = (requiredScope) => {
    return (req, res, next) => {
        const scopes = req.scimToken?.scopes || [];
        
        // Check for wildcard or exact match
        if (scopes.includes('*') || scopes.includes(requiredScope)) {
            return next();
        }

        // Check for partial match (e.g., 'users:write' includes 'users:read')
        const [resource, action] = requiredScope.split(':');
        if (action === 'read' && scopes.includes(`${resource}:write`)) {
            return next();
        }

        return res.status(403).json(scimService.createErrorResponse(
            403, 'forbidden', `Insufficient scope. Required: ${requiredScope}`
        ));
    };
};

// ====== SCIM 2.0 DISCOVERY ENDPOINTS ======

/**
 * GET /ServiceProviderConfig
 * Returns SCIM service provider configuration
 */
router.get('/ServiceProviderConfig', scimAuth, (req, res) => {
    const baseUrl = `${req.protocol}://${req.get('host')}/api`;
    res.json(scimService.getServiceProviderConfig(req.organizationId, baseUrl));
});

/**
 * GET /Schemas
 * Returns supported SCIM schemas
 */
router.get('/Schemas', scimAuth, (req, res) => {
    res.json(scimService.getSchemas());
});

/**
 * GET /Schemas/:id
 * Returns specific schema
 */
router.get('/Schemas/:id', scimAuth, (req, res) => {
    const schemas = scimService.getSchemas();
    const schema = schemas.Resources.find(s => s.id === req.params.id);
    
    if (!schema) {
        return res.status(404).json(scimService.createErrorResponse(
            404, 'noTarget', 'Schema not found'
        ));
    }
    
    res.json(schema);
});

/**
 * GET /ResourceTypes
 * Returns supported resource types
 */
router.get('/ResourceTypes', scimAuth, (req, res) => {
    res.json(scimService.getResourceTypes());
});

/**
 * GET /ResourceTypes/:id
 * Returns specific resource type
 */
router.get('/ResourceTypes/:id', scimAuth, (req, res) => {
    const resourceTypes = scimService.getResourceTypes();
    const resourceType = resourceTypes.Resources.find(r => r.id === req.params.id);
    
    if (!resourceType) {
        return res.status(404).json(scimService.createErrorResponse(
            404, 'noTarget', 'ResourceType not found'
        ));
    }
    
    res.json(resourceType);
});

// ====== SCIM 2.0 USER ENDPOINTS ======

/**
 * GET /Users
 * List users with filtering and pagination
 */
router.get('/Users', scimAuth, requireScope('users:read'), async (req, res) => {
    try {
        const { filter, startIndex, count } = req.query;
        
        const result = await scimService.listUsers(req.organizationId, {
            filter,
            startIndex: parseInt(startIndex) || 1,
            count: parseInt(count) || 100
        });
        
        res.json(result);
    } catch (error) {
        console.error('[SCIM] List users error:', error);
        res.status(500).json(scimService.createErrorResponse(
            500, 'internal', 'Failed to list users'
        ));
    }
});

/**
 * POST /Users
 * Create a new user
 */
router.post('/Users', scimAuth, requireScope('users:write'), async (req, res) => {
    try {
        const user = await scimService.createUser(
            req.organizationId,
            req.body,
            req.scimToken.tokenId
        );
        
        res.status(201)
            .location(`/scim/v2/Users/${user.id}`)
            .json(user);
    } catch (error) {
        console.error('[SCIM] Create user error:', error);
        
        if (error.status) {
            return res.status(error.status).json(scimService.createErrorResponse(
                error.status, error.scimType, error.detail
            ));
        }
        
        res.status(500).json(scimService.createErrorResponse(
            500, 'internal', 'Failed to create user'
        ));
    }
});

/**
 * GET /Users/:id
 * Get a specific user by SCIM ID
 */
router.get('/Users/:id', scimAuth, requireScope('users:read'), async (req, res) => {
    try {
        const user = await scimService.getUser(req.organizationId, req.params.id);
        
        if (!user) {
            return res.status(404).json(scimService.createErrorResponse(
                404, 'noTarget', 'User not found'
            ));
        }
        
        res.json(user);
    } catch (error) {
        console.error('[SCIM] Get user error:', error);
        res.status(500).json(scimService.createErrorResponse(
            500, 'internal', 'Failed to get user'
        ));
    }
});

/**
 * PUT /Users/:id
 * Replace a user (full update)
 */
router.put('/Users/:id', scimAuth, requireScope('users:write'), async (req, res) => {
    try {
        const user = await scimService.updateUser(
            req.organizationId,
            req.params.id,
            req.body,
            req.scimToken.tokenId
        );
        
        res.json(user);
    } catch (error) {
        console.error('[SCIM] Update user error:', error);
        
        if (error.status) {
            return res.status(error.status).json(scimService.createErrorResponse(
                error.status, error.scimType, error.detail
            ));
        }
        
        res.status(500).json(scimService.createErrorResponse(
            500, 'internal', 'Failed to update user'
        ));
    }
});

/**
 * PATCH /Users/:id
 * Partially update a user
 */
router.patch('/Users/:id', scimAuth, requireScope('users:write'), async (req, res) => {
    try {
        const { Operations } = req.body;
        
        if (!Operations || !Array.isArray(Operations)) {
            return res.status(400).json(scimService.createErrorResponse(
                400, 'invalidSyntax', 'Operations array required'
            ));
        }
        
        const user = await scimService.patchUser(
            req.organizationId,
            req.params.id,
            Operations,
            req.scimToken.tokenId
        );
        
        res.json(user);
    } catch (error) {
        console.error('[SCIM] Patch user error:', error);
        
        if (error.status) {
            return res.status(error.status).json(scimService.createErrorResponse(
                error.status, error.scimType, error.detail
            ));
        }
        
        res.status(500).json(scimService.createErrorResponse(
            500, 'internal', 'Failed to patch user'
        ));
    }
});

/**
 * DELETE /Users/:id
 * Delete a user
 */
router.delete('/Users/:id', scimAuth, requireScope('users:write'), async (req, res) => {
    try {
        await scimService.deleteUser(
            req.organizationId,
            req.params.id,
            req.scimToken.tokenId
        );
        
        res.status(204).send();
    } catch (error) {
        console.error('[SCIM] Delete user error:', error);
        
        if (error.status) {
            return res.status(error.status).json(scimService.createErrorResponse(
                error.status, error.scimType, error.detail
            ));
        }
        
        res.status(500).json(scimService.createErrorResponse(
            500, 'internal', 'Failed to delete user'
        ));
    }
});

// ====== ADMIN TOKEN MANAGEMENT ENDPOINTS ======

/**
 * GET /admin/service-provider
 * Get SCIM service provider configuration for admin
 */
router.get('/admin/service-provider', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const config = await scimService.getServiceProvider(req.user.organization_id);
        res.json({ success: true, data: config });
    } catch (error) {
        console.error('[SCIM] Get service provider error:', error);
        res.status(500).json({ success: false, error: 'Failed to get service provider configuration' });
    }
});

/**
 * POST /admin/service-provider
 * Create or update SCIM service provider configuration
 */
router.post('/admin/service-provider', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const result = await scimService.upsertServiceProvider(req.user.organization_id, req.body);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[SCIM] Update service provider error:', error);
        res.status(500).json({ success: false, error: 'Failed to update service provider configuration' });
    }
});

/**
 * GET /admin/tokens
 * List all SCIM tokens for the organization
 */
router.get('/admin/tokens', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const tokens = await scimService.listTokens(req.user.organization_id);
        res.json({ success: true, data: tokens });
    } catch (error) {
        console.error('[SCIM] List tokens error:', error);
        res.status(500).json({ success: false, error: 'Failed to list tokens' });
    }
});

/**
 * POST /admin/tokens
 * Generate a new SCIM token
 */
router.post('/admin/tokens', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const { name, description, scopes, expiresAt } = req.body;
        
        if (!name) {
            return res.status(400).json({ success: false, error: 'Token name is required' });
        }
        
        const token = await scimService.generateToken(req.user.organization_id, name, {
            description,
            scopes,
            expiresAt,
            createdBy: req.user.id
        });
        
        res.status(201).json({ 
            success: true, 
            data: token,
            warning: 'Store this token securely. It cannot be retrieved again.'
        });
    } catch (error) {
        console.error('[SCIM] Generate token error:', error);
        res.status(500).json({ success: false, error: 'Failed to generate token' });
    }
});

/**
 * DELETE /admin/tokens/:id
 * Revoke a SCIM token
 */
router.delete('/admin/tokens/:id', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const result = await scimService.revokeToken(req.params.id, req.user.id);
        
        if (!result.revoked) {
            return res.status(404).json({ success: false, error: 'Token not found' });
        }
        
        res.json({ success: true, message: 'Token revoked successfully' });
    } catch (error) {
        console.error('[SCIM] Revoke token error:', error);
        res.status(500).json({ success: false, error: 'Failed to revoke token' });
    }
});

/**
 * GET /admin/group-mappings
 * List group-to-role mappings
 */
router.get('/admin/group-mappings', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const mappings = await scimService.getGroupMappings(req.user.organization_id);
        res.json({ success: true, data: mappings });
    } catch (error) {
        console.error('[SCIM] List group mappings error:', error);
        res.status(500).json({ success: false, error: 'Failed to list group mappings' });
    }
});

/**
 * POST /admin/group-mappings
 * Create or update a group-to-role mapping
 */
router.post('/admin/group-mappings', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const { externalGroupId, externalGroupName, internalRole, customRoleId, isActive } = req.body;
        
        if (!externalGroupId || !externalGroupName || !internalRole) {
            return res.status(400).json({ 
                success: false, 
                error: 'externalGroupId, externalGroupName, and internalRole are required' 
            });
        }
        
        const result = await scimService.upsertGroupMapping(req.user.organization_id, {
            externalGroupId,
            externalGroupName,
            internalRole,
            customRoleId,
            isActive
        });
        
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[SCIM] Create group mapping error:', error);
        res.status(500).json({ success: false, error: 'Failed to create group mapping' });
    }
});

/**
 * DELETE /admin/group-mappings/:id
 * Delete a group-to-role mapping
 */
router.delete('/admin/group-mappings/:id', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const result = await scimService.deleteGroupMapping(req.user.organization_id, req.params.id);
        
        if (!result.deleted) {
            return res.status(404).json({ success: false, error: 'Mapping not found' });
        }
        
        res.json({ success: true, message: 'Group mapping deleted successfully' });
    } catch (error) {
        console.error('[SCIM] Delete group mapping error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete group mapping' });
    }
});

/**
 * GET /admin/sync-logs
 * Get SCIM sync logs
 */
router.get('/admin/sync-logs', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const { limit, offset, status, operation, resourceType } = req.query;
        
        const logs = await scimService.getSyncLogs(req.user.organization_id, {
            limit: parseInt(limit) || 100,
            offset: parseInt(offset) || 0,
            status,
            operation,
            resourceType
        });
        
        res.json({ success: true, data: logs });
    } catch (error) {
        console.error('[SCIM] Get sync logs error:', error);
        res.status(500).json({ success: false, error: 'Failed to get sync logs' });
    }
});

export default router;

