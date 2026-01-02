/**
 * MCP Routes - Model Context Protocol HTTP API
 * 
 * HTTP endpoints for MCP protocol communication.
 * Enables AI clients (Claude, Cursor, etc.) to interact with Consultify.
 * 
 * Based on Anthropic MCP Specification:
 * https://modelcontextprotocol.io/docs
 * 
 * Part of: User-Level Notifications & Integrations System
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const MCPServer = require('../mcp/mcpServer');

// All MCP routes require authentication
router.use(authMiddleware);

// ==========================================
// SERVER INFO
// ==========================================

/**
 * POST /api/mcp/initialize
 * Initialize MCP session and get server capabilities
 */
router.post('/initialize', async (req, res) => {
    try {
        const serverInfo = MCPServer.getServerInfo();
        
        res.json({
            protocolVersion: serverInfo.protocolVersion,
            capabilities: serverInfo.capabilities,
            serverInfo: serverInfo.serverInfo
        });
    } catch (error) {
        console.error('[MCP] Initialize error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// TOOLS
// ==========================================

/**
 * GET /api/mcp/tools/list
 * List available tools
 */
router.get('/tools/list', async (req, res) => {
    try {
        const result = MCPServer.listTools();
        res.json(result);
    } catch (error) {
        console.error('[MCP] List tools error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/mcp/tools/call
 * Execute a tool
 */
router.post('/tools/call', async (req, res) => {
    try {
        const { name, arguments: toolArgs } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Tool name required' });
        }
        
        const userContext = {
            userId: req.user.id,
            organizationId: req.user.organizationId
        };
        
        const result = await MCPServer.executeTool(name, toolArgs || {}, userContext);
        
        res.json(result);
    } catch (error) {
        console.error('[MCP] Tool call error:', error);
        res.status(500).json({ 
            isError: true,
            content: [{ type: 'text', text: error.message }]
        });
    }
});

// ==========================================
// RESOURCES
// ==========================================

/**
 * GET /api/mcp/resources/list
 * List available resources
 */
router.get('/resources/list', async (req, res) => {
    try {
        const result = MCPServer.listResources();
        res.json(result);
    } catch (error) {
        console.error('[MCP] List resources error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/mcp/resources/read
 * Read a resource
 */
router.post('/resources/read', async (req, res) => {
    try {
        const { uri } = req.body;
        
        if (!uri) {
            return res.status(400).json({ error: 'Resource URI required' });
        }
        
        const userContext = {
            userId: req.user.id,
            organizationId: req.user.organizationId
        };
        
        const result = await MCPServer.readResource(uri, userContext);
        
        res.json(result);
    } catch (error) {
        console.error('[MCP] Read resource error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/mcp/resources/subscribe
 * Subscribe to resource updates (placeholder)
 */
router.post('/resources/subscribe', async (req, res) => {
    try {
        const { uri } = req.body;
        
        // Subscription management would be implemented here
        // For now, just acknowledge
        
        res.json({ subscribed: true, uri });
    } catch (error) {
        console.error('[MCP] Subscribe error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// PROMPTS
// ==========================================

/**
 * GET /api/mcp/prompts/list
 * List available prompts
 */
router.get('/prompts/list', async (req, res) => {
    try {
        const result = MCPServer.listPrompts();
        res.json(result);
    } catch (error) {
        console.error('[MCP] List prompts error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/mcp/prompts/get
 * Get a prompt with filled arguments
 */
router.post('/prompts/get', async (req, res) => {
    try {
        const { name, arguments: promptArgs } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Prompt name required' });
        }
        
        const userContext = {
            userId: req.user.id,
            organizationId: req.user.organizationId
        };
        
        const result = await MCPServer.getPrompt(name, promptArgs || {}, userContext);
        
        res.json(result);
    } catch (error) {
        console.error('[MCP] Get prompt error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// NOTIFICATIONS (MCP-specific)
// ==========================================

/**
 * POST /api/mcp/notifications/send
 * Send a notification through MCP
 */
router.post('/notifications/send', async (req, res) => {
    try {
        const { title, message, userId: targetUserId, type } = req.body;
        
        if (!title || !message) {
            return res.status(400).json({ error: 'Title and message required' });
        }
        
        const userContext = {
            userId: req.user.id,
            organizationId: req.user.organizationId
        };
        
        const result = await MCPServer.executeTool(
            'consultify.notifications.send',
            { title, message, userId: targetUserId, type },
            userContext
        );
        
        res.json(result);
    } catch (error) {
        console.error('[MCP] Send notification error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// HEALTH & STATUS
// ==========================================

/**
 * GET /api/mcp/health
 * Health check
 */
router.get('/health', async (req, res) => {
    res.json({
        status: 'ok',
        version: MCPServer.VERSION,
        timestamp: new Date().toISOString()
    });
});

module.exports = router;


