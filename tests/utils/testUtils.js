/**
 * Test Utilities - Common helpers for all tests
 * 
 * This module provides:
 * - Factory functions for test data
 * - Common mocks for external services
 * - API test helpers
 * - Database setup utilities
 */

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { vi } = require('vitest');

// ============================================
// Test Data Factories
// ============================================

/**
 * Create a unique test organization
 * @param {object} overrides - Override default values
 * @returns {object} Organization data
 */
function createOrganization(overrides = {}) {
    const id = overrides.id || `test-org-${uuidv4().slice(0, 8)}`;
    return {
        id,
        name: overrides.name || `Test Org ${id.slice(-4)}`,
        plan: overrides.plan || 'professional',
        status: overrides.status || 'active',
        created_at: overrides.created_at || new Date().toISOString(),
        settings: overrides.settings || JSON.stringify({}),
        ...overrides,
    };
}

/**
 * Create a unique test user
 * @param {object} overrides - Override default values  
 * @returns {object} User data with hashed password
 */
function createUser(overrides = {}) {
    const id = overrides.id || `test-user-${uuidv4().slice(0, 8)}`;
    const email = overrides.email || `${id}@test.com`;
    const plainPassword = overrides.password || 'TestPass123!';

    return {
        id,
        organization_id: overrides.organization_id || overrides.organizationId || null,
        email,
        password: bcrypt.hashSync(plainPassword, 8),
        plainPassword, // Keep for login tests
        first_name: overrides.first_name || overrides.firstName || 'Test',
        last_name: overrides.last_name || overrides.lastName || 'User',
        role: overrides.role || 'USER',
        status: overrides.status || 'active',
        created_at: overrides.created_at || new Date().toISOString(),
        ...overrides,
    };
}

/**
 * Create a test project
 * @param {object} overrides - Override default values
 * @returns {object} Project data
 */
function createProject(overrides = {}) {
    const id = overrides.id || `test-proj-${uuidv4().slice(0, 8)}`;
    return {
        id,
        organization_id: overrides.organization_id || null,
        user_id: overrides.user_id || null,
        name: overrides.name || `Test Project ${id.slice(-4)}`,
        description: overrides.description || 'Test project description',
        status: overrides.status || 'active',
        created_at: overrides.created_at || new Date().toISOString(),
        ...overrides,
    };
}

/**
 * Create a test task
 * @param {object} overrides - Override default values
 * @returns {object} Task data
 */
function createTask(overrides = {}) {
    const id = overrides.id || `test-task-${uuidv4().slice(0, 8)}`;
    return {
        id,
        project_id: overrides.project_id || null,
        user_id: overrides.user_id || null,
        title: overrides.title || `Test Task ${id.slice(-4)}`,
        description: overrides.description || 'Test task description',
        status: overrides.status || 'pending',
        priority: overrides.priority || 'medium',
        due_date: overrides.due_date || null,
        created_at: overrides.created_at || new Date().toISOString(),
        ...overrides,
    };
}

/**
 * Create a test initiative
 * @param {object} overrides - Override default values
 * @returns {object} Initiative data
 */
function createInitiative(overrides = {}) {
    const id = overrides.id || `test-init-${uuidv4().slice(0, 8)}`;
    return {
        id,
        organization_id: overrides.organization_id || null,
        user_id: overrides.user_id || null,
        title: overrides.title || `Test Initiative ${id.slice(-4)}`,
        description: overrides.description || 'Test initiative description',
        category: overrides.category || 'process',
        priority: overrides.priority || 'medium',
        status: overrides.status || 'active',
        impact_score: overrides.impact_score || 5,
        effort_score: overrides.effort_score || 3,
        created_at: overrides.created_at || new Date().toISOString(),
        ...overrides,
    };
}

// ============================================
// JWT / Auth Helpers
// ============================================

const TEST_JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-testing';

/**
 * Generate a valid JWT token for testing
 * @param {object} user - User object
 * @param {object} options - JWT options
 * @returns {string} JWT token
 */
function generateTestToken(user, options = {}) {
    const payload = {
        userId: user.id,
        email: user.email,
        role: user.role || 'USER',
        organizationId: user.organization_id,
        ...options.payload,
    };

    return jwt.sign(payload, TEST_JWT_SECRET, {
        expiresIn: options.expiresIn || '1h',
    });
}

/**
 * Create authorization header for API tests
 * @param {object} user - User object
 * @returns {object} Headers object with Authorization
 */
function authHeader(user) {
    return {
        Authorization: `Bearer ${generateTestToken(user)}`,
    };
}

// ============================================
// API Test Helpers
// ============================================

/**
 * Helper to make authenticated API requests with supertest
 * @param {object} request - Supertest request object
 * @param {object} user - User for authentication
 * @returns {object} Request with auth header
 */
function authenticatedRequest(request, user) {
    return request.set('Authorization', `Bearer ${generateTestToken(user)}`);
}

/**
 * Common response assertions
 */
const assertions = {
    /**
     * Assert successful response with data
     */
    successWithData(response, statusCode = 200) {
        expect(response.status).toBe(statusCode);
        expect(response.body).toBeDefined();
        return response.body;
    },

    /**
     * Assert error response
     */
    error(response, statusCode, messageContains = null) {
        expect(response.status).toBe(statusCode);
        if (messageContains) {
            expect(response.body.error || response.body.message).toContain(messageContains);
        }
    },

    /**
     * Assert paginated response
     */
    paginated(response, expectedFields = ['data', 'total', 'page', 'limit']) {
        expect(response.status).toBe(200);
        expectedFields.forEach(field => {
            expect(response.body).toHaveProperty(field);
        });
    },
};

// ============================================
// Mock Factories
// ============================================

/**
 * Create mock for LLM API responses
 */
function createLLMMock(provider = 'openai') {
    const responses = {
        openai: {
            id: 'chatcmpl-test',
            object: 'chat.completion',
            created: Date.now(),
            model: 'gpt-4',
            choices: [{
                index: 0,
                message: {
                    role: 'assistant',
                    content: 'This is a mock response from OpenAI.',
                },
                finish_reason: 'stop',
            }],
            usage: {
                prompt_tokens: 10,
                completion_tokens: 20,
                total_tokens: 30,
            },
        },
        gemini: {
            candidates: [{
                content: {
                    parts: [{ text: 'This is a mock response from Gemini.' }],
                    role: 'model',
                },
                finishReason: 'STOP',
            }],
            usageMetadata: {
                promptTokenCount: 10,
                candidatesTokenCount: 20,
                totalTokenCount: 30,
            },
        },
        anthropic: {
            id: 'msg-test',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'This is a mock response from Claude.' }],
            model: 'claude-3-opus',
            stop_reason: 'end_turn',
            usage: {
                input_tokens: 10,
                output_tokens: 20,
            },
        },
    };

    return responses[provider] || responses.openai;
}

/**
 * Create mock for Stripe API
 */
function createStripeMock() {
    return {
        customers: {
            create: vi.fn().mockResolvedValue({ id: 'cus_test123' }),
            retrieve: vi.fn().mockResolvedValue({ id: 'cus_test123', email: 'test@test.com' }),
        },
        subscriptions: {
            create: vi.fn().mockResolvedValue({ id: 'sub_test123', status: 'active' }),
            retrieve: vi.fn().mockResolvedValue({ id: 'sub_test123', status: 'active' }),
            update: vi.fn().mockResolvedValue({ id: 'sub_test123', status: 'active' }),
            cancel: vi.fn().mockResolvedValue({ id: 'sub_test123', status: 'canceled' }),
        },
        invoices: {
            list: vi.fn().mockResolvedValue({ data: [] }),
            retrieve: vi.fn().mockResolvedValue({ id: 'inv_test123', status: 'paid' }),
        },
        paymentIntents: {
            create: vi.fn().mockResolvedValue({ id: 'pi_test123', status: 'succeeded' }),
        },
        webhooks: {
            constructEvent: vi.fn().mockReturnValue({ type: 'test.event', data: {} }),
        },
    };
}

// ============================================
// Database Helpers (Enhanced)
// ============================================

/**
 * Enable SQLite foreign key constraints
 * IMPORTANT: Call this at the start of tests that need FK enforcement
 */
async function enableForeignKeys(db) {
    return new Promise((resolve, reject) => {
        db.run('PRAGMA foreign_keys = ON', (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

/**
 * Insert test data into database
 * @param {object} db - Database instance
 * @param {string} table - Table name
 * @param {object} data - Data to insert
 */
async function insertTestData(db, table, data) {
    const columns = Object.keys(data);
    const placeholders = columns.map(() => '?').join(', ');
    const values = Object.values(data);

    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
            values,
            function (err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes });
            }
        );
    });
}

/**
 * Clean specific tables between tests
 * @param {object} db - Database instance
 * @param {string[]} tables - Tables to clean
 */
async function cleanTables(db, tables) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Disable FK temporarily for faster cleanup
            db.run('PRAGMA foreign_keys = OFF');

            let completed = 0;
            tables.forEach(table => {
                db.run(`DELETE FROM ${table}`, () => {
                    completed++;
                    if (completed === tables.length) {
                        db.run('PRAGMA foreign_keys = ON', resolve);
                    }
                });
            });
        });
    });
}

// ============================================
// Timing Helpers
// ============================================

/**
 * Wait for a specified time
 * @param {number} ms - Milliseconds to wait
 */
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for a condition to be true
 * @param {function} condition - Function that returns boolean
 * @param {number} timeout - Max time to wait in ms
 * @param {number} interval - Check interval in ms
 */
async function waitFor(condition, timeout = 5000, interval = 100) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        if (await condition()) return true;
        await wait(interval);
    }
    throw new Error(`Condition not met within ${timeout}ms`);
}

// ============================================
// Exports
// ============================================

module.exports = {
    // Factories
    createOrganization,
    createUser,
    createProject,
    createTask,
    createInitiative,

    // Auth helpers
    generateTestToken,
    authHeader,
    authenticatedRequest,
    TEST_JWT_SECRET,

    // Assertions
    assertions,

    // Mocks
    createLLMMock,
    createStripeMock,

    // Database helpers
    enableForeignKeys,
    insertTestData,
    cleanTables,

    // Timing
    wait,
    waitFor,
};
