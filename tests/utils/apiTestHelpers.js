/**
 * API Test Helpers
 * 
 * Provides utilities for testing API routes with proper authentication,
 * database setup, and common assertions.
 */

const request = require('supertest');
const { createOrganization, createUser, generateTestToken } = require('./testUtils');

// ============================================
// App Setup
// ============================================

let cachedApp = null;

/**
 * Get the Express app instance for testing
 * Caches the app to avoid re-initialization between tests
 */
async function getApp() {
    if (cachedApp) return cachedApp;

    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.DB_TYPE = 'sqlite';
    process.env.JWT_SECRET = 'test-secret-key-for-testing';

    // Import app after setting env vars
    const { app } = require('../../server/index.js');
    cachedApp = app;

    return app;
}

/**
 * Reset the cached app (useful between test files)
 */
function resetApp() {
    cachedApp = null;
}

// ============================================
// Request Builders
// ============================================

/**
 * Create an authenticated request builder
 * @param {object} config - Configuration
 * @param {object} config.user - User to authenticate as
 * @param {object} config.org - Organization (optional, will create if not provided)
 * @returns {object} Request builder with convenience methods
 */
function createAuthenticatedClient(config = {}) {
    const org = config.org || createOrganization();
    const user = config.user || createUser({ organization_id: org.id });
    const token = generateTestToken(user);

    return {
        user,
        org,
        token,

        /**
         * Make authenticated GET request
         */
        async get(path) {
            const app = await getApp();
            return request(app)
                .get(path)
                .set('Authorization', `Bearer ${token}`);
        },

        /**
         * Make authenticated POST request
         */
        async post(path, body = {}) {
            const app = await getApp();
            return request(app)
                .post(path)
                .set('Authorization', `Bearer ${token}`)
                .send(body);
        },

        /**
         * Make authenticated PUT request
         */
        async put(path, body = {}) {
            const app = await getApp();
            return request(app)
                .put(path)
                .set('Authorization', `Bearer ${token}`)
                .send(body);
        },

        /**
         * Make authenticated PATCH request
         */
        async patch(path, body = {}) {
            const app = await getApp();
            return request(app)
                .patch(path)
                .set('Authorization', `Bearer ${token}`)
                .send(body);
        },

        /**
         * Make authenticated DELETE request
         */
        async delete(path) {
            const app = await getApp();
            return request(app)
                .delete(path)
                .set('Authorization', `Bearer ${token}`);
        },
    };
}

/**
 * Create an unauthenticated request builder
 */
function createAnonymousClient() {
    return {
        async get(path) {
            const app = await getApp();
            return request(app).get(path);
        },

        async post(path, body = {}) {
            const app = await getApp();
            return request(app).post(path).send(body);
        },

        async put(path, body = {}) {
            const app = await getApp();
            return request(app).put(path).send(body);
        },

        async delete(path) {
            const app = await getApp();
            return request(app).delete(path);
        },
    };
}

// ============================================
// Common Test Scenarios
// ============================================

/**
 * Test that an endpoint requires authentication
 * @param {string} method - HTTP method
 * @param {string} path - API path
 */
async function expectAuthRequired(method, path) {
    const client = createAnonymousClient();
    const response = await client[method.toLowerCase()](path);

    expect([401, 403]).toContain(response.status);
    return response;
}

/**
 * Test that an endpoint requires admin role
 * @param {string} method - HTTP method
 * @param {string} path - API path
 * @param {object} body - Request body (for POST/PUT)
 */
async function expectAdminRequired(method, path, body = {}) {
    const userClient = createAuthenticatedClient({
        user: createUser({ role: 'USER' }),
    });

    let response;
    if (method.toUpperCase() === 'GET') {
        response = await userClient.get(path);
    } else if (method.toUpperCase() === 'POST') {
        response = await userClient.post(path, body);
    } else if (method.toUpperCase() === 'PUT') {
        response = await userClient.put(path, body);
    } else if (method.toUpperCase() === 'DELETE') {
        response = await userClient.delete(path);
    }

    expect([401, 403]).toContain(response.status);
    return response;
}

/**
 * Test CRUD operations on a resource
 * @param {string} basePath - Base API path (e.g., '/api/tasks')
 * @param {object} createData - Data to create resource
 * @param {object} updateData - Data to update resource
 */
async function testCrudOperations(basePath, createData, updateData) {
    const client = createAuthenticatedClient();
    const results = {};

    // Create
    const createResponse = await client.post(basePath, createData);
    expect(createResponse.status).toBe(201);
    results.created = createResponse.body;

    // Read
    const readResponse = await client.get(`${basePath}/${results.created.id}`);
    expect(readResponse.status).toBe(200);
    results.read = readResponse.body;

    // Update
    const updateResponse = await client.put(`${basePath}/${results.created.id}`, updateData);
    expect(updateResponse.status).toBe(200);
    results.updated = updateResponse.body;

    // List
    const listResponse = await client.get(basePath);
    expect(listResponse.status).toBe(200);
    results.list = listResponse.body;

    // Delete
    const deleteResponse = await client.delete(`${basePath}/${results.created.id}`);
    expect(deleteResponse.status).toBe(200);
    results.deleted = deleteResponse.body;

    return results;
}

// ============================================
// Response Validators
// ============================================

const validators = {
    /**
     * Validate pagination structure
     */
    pagination(body) {
        expect(body).toHaveProperty('data');
        expect(Array.isArray(body.data)).toBe(true);
        expect(body).toHaveProperty('pagination');
        expect(body.pagination).toHaveProperty('page');
        expect(body.pagination).toHaveProperty('limit');
        expect(body.pagination).toHaveProperty('total');
    },

    /**
     * Validate error response structure
     */
    error(body) {
        expect(body).toHaveProperty('error');
        // Some errors use 'message' instead of 'error'
        const hasMessage = body.error || body.message;
        expect(hasMessage).toBeTruthy();
    },

    /**
     * Validate success response with data
     */
    success(body) {
        expect(body).toBeDefined();
        expect(body.error).toBeUndefined();
    },

    /**
     * Validate user object structure
     */
    user(user) {
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('role');
        // Password should never be returned
        expect(user.password).toBeUndefined();
    },

    /**
     * Validate organization object structure
     */
    organization(org) {
        expect(org).toHaveProperty('id');
        expect(org).toHaveProperty('name');
        expect(org).toHaveProperty('plan');
    },
};

// ============================================
// Exports
// ============================================

module.exports = {
    getApp,
    resetApp,
    createAuthenticatedClient,
    createAnonymousClient,
    expectAuthRequired,
    expectAdminRequired,
    testCrudOperations,
    validators,
};
