import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';

const { initTestDb, cleanTables, dbRun, db } = require('../../helpers/dbHelper.cjs');
const ConnectorService = require('../../../server/src/services/connectorService');
const { v4: uuidv4 } = require('uuid');

describe('ConnectorService', () => {
    let testOrgId;
    let testUserId;
    let testConnectorKey;

    beforeAll(async () => {
        await initTestDb();
        ConnectorService.setDependencies({ db });
    });

    beforeEach(async () => {
        // Create test organization
        testOrgId = uuidv4();
        await dbRun(
            `INSERT INTO organizations (id, name, plan, status, organization_type) 
             VALUES (?, ?, ?, ?, ?)`,
            [testOrgId, 'Test Org', 'professional', 'active', 'PAID']
        );

        // Create test user
        testUserId = uuidv4();
        await dbRun(
            `INSERT INTO users (id, organization_id, email, name, role, created_at) 
             VALUES (?, ?, ?, ?, ?, datetime('now'))`,
            [testUserId, testOrgId, 'user@test.com', 'Test User', 'client']
        );

        // Create test connector in catalog
        testConnectorKey = 'jira'; // Use an existing key from registry for validation
        await dbRun(
            `INSERT OR IGNORE INTO connectors (key, name, category, capabilities_json, is_available, created_at)
             VALUES (?, ?, ?, ?, ?, datetime('now'))`,
            [
                testConnectorKey,
                'Jira Cloud',
                'project_management',
                JSON.stringify(['read', 'write']),
                1
            ]
        );
    });

    afterEach(async () => {
        await cleanTables([
            'org_connector_configs',
            'connector_health',
            'connectors',
            'users',
            'organizations'
        ]);
        vi.clearAllMocks();
    });

    describe('getCatalog', () => {
        it('should return available connectors', async () => {
            const catalog = await ConnectorService.getCatalog();
            expect(Array.isArray(catalog)).toBe(true);
            expect(catalog.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('connect', () => {
        it('should create connector configuration', async () => {
            const secrets = { domain: 'test.atlassian.net', email: 'test@test.com', api_token: 'token123' };
            const scopes = ['read', 'write'];

            const config = await ConnectorService.connect(
                testOrgId,
                testConnectorKey,
                secrets,
                scopes,
                { configuredBy: testUserId, sandboxMode: true }
            );

            expect(config).toBeDefined();
            expect(config.connector_key).toBe(testConnectorKey);
            expect(config.status).toBe('CONNECTED');
        });

        it('should encrypt secrets before storage', async () => {
            const secrets = { domain: 'test.atlassian.net', email: 'test@test.com', api_token: 'secret-key' };

            await ConnectorService.connect(testOrgId, testConnectorKey, secrets, [], { configuredBy: testUserId });

            const configs = await new Promise((resolve, reject) => {
                db.all('SELECT encrypted_secrets FROM org_connector_configs WHERE org_id = ?', [testOrgId], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            expect(configs[0].encrypted_secrets).toBeDefined();
            expect(configs[0].encrypted_secrets).not.toContain('secret-key');
        });
    });

    describe('disconnect', () => {
        it('should delete connector configuration', async () => {
            const secrets = { domain: 'test.atlassian.net', email: 'test@test.com', api_token: 'token' };
            await ConnectorService.connect(testOrgId, testConnectorKey, secrets, [], { configuredBy: testUserId });

            const success = await ConnectorService.disconnect(testOrgId, testConnectorKey, testUserId);
            expect(success).toBe(true);

            const configs = await ConnectorService.getOrgConfigs(testOrgId);
            expect(configs.length).toBe(0);
        });
    });

    describe('updateSecret', () => {
        it('should update existing configuration secrets', async () => {
            const secrets1 = { domain: 'test.atlassian.net', email: 'test@test.com', api_token: 'token1' };
            await ConnectorService.connect(testOrgId, testConnectorKey, secrets1, [], { configuredBy: testUserId });

            const secrets2 = { domain: 'test.atlassian.net', email: 'test@test.com', api_token: 'token2' };
            const success = await ConnectorService.updateSecret(testOrgId, testConnectorKey, secrets2, testUserId);
            expect(success).toBe(true);

            const decrypted = await ConnectorService.getSecrets(testOrgId, testConnectorKey);
            expect(decrypted.api_token).toBe('token2');
        });
    });
});
