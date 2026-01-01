/**
 * ConnectorService Tests
 * 
 * Tests for connector configuration CRUD operations.
 */

const { initTestDb, cleanTables, dbAll, dbRun } = require('../../helpers/dbHelper.cjs');
const ConnectorService = require('../../../server/services/connectorService');
const { v4: uuidv4 } = require('uuid');

describe('ConnectorService', () => {
    let testOrgId;
    let testUserId;
    let testConnectorKey;

    beforeAll(async () => {
        await initTestDb();
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
        testConnectorKey = 'test_connector';
        await dbRun(
            `INSERT INTO connectors (key, name, category, capabilities_json, is_available, created_at)
             VALUES (?, ?, ?, ?, ?, datetime('now'))`,
            [
                testConnectorKey,
                'Test Connector',
                'test',
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
    });

    describe('getCatalog', () => {
        it('should return available connectors', async () => {
            const catalog = await ConnectorService.getCatalog();

            expect(Array.isArray(catalog)).toBe(true);
            expect(catalog.length).toBeGreaterThanOrEqual(1);
        });

        it('should only return available connectors', async () => {
            // Create unavailable connector
            await dbRun(
                `INSERT INTO connectors (key, name, category, capabilities_json, is_available, created_at)
                 VALUES (?, ?, ?, ?, ?, datetime('now'))`,
                ['unavailable_connector', 'Unavailable', 'test', '[]', 0]
            );

            const catalog = await ConnectorService.getCatalog();

            expect(catalog.every(c => c.is_available === 1)).toBe(true);
        });

        it('should parse capabilities JSON', async () => {
            const catalog = await ConnectorService.getCatalog();

            const connector = catalog.find(c => c.key === testConnectorKey);
            if (connector) {
                expect(Array.isArray(connector.capabilities)).toBe(true);
            }
        });
    });

    describe('getOrgConfigs', () => {
        it('should return empty array when no configs', async () => {
            const configs = await ConnectorService.getOrgConfigs(testOrgId);

            expect(configs).toEqual([]);
        });

        it('should return org connector configs', async () => {
            // Create connector config
            const configId = uuidv4();
            await dbRun(
                `INSERT INTO org_connector_configs 
                 (id, org_id, connector_key, status, scopes_json, configured_by, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                [configId, testOrgId, testConnectorKey, 'active', JSON.stringify(['read']), testUserId]
            );

            const configs = await ConnectorService.getOrgConfigs(testOrgId);

            expect(configs.length).toBeGreaterThan(0);
            expect(configs[0].connector_key).toBe(testConnectorKey);
        });

        it('should redact secrets in response', async () => {
            const SecretsVault = require('../../../server/services/secretsVault');
            const secrets = { apiKey: 'secret-key', password: 'password123' };
            const encryptedSecrets = SecretsVault.encrypt(secrets);

            const configId = uuidv4();
            await dbRun(
                `INSERT INTO org_connector_configs 
                 (id, org_id, connector_key, status, encrypted_secrets, configured_by, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                [configId, testOrgId, testConnectorKey, 'active', encryptedSecrets, testUserId]
            );

            const configs = await ConnectorService.getOrgConfigs(testOrgId);

            expect(configs[0].secrets).toBeDefined();
            // Secrets should be redacted (not contain actual values)
            expect(configs[0].secrets.apiKey).not.toBe('secret-key');
        });
    });

    describe('createConfig', () => {
        it('should create connector configuration', async () => {
            const secrets = { apiKey: 'test-key' };
            const scopes = ['read', 'write'];

            const config = await ConnectorService.createConfig(
                testOrgId,
                testConnectorKey,
                {
                    secrets,
                    scopes,
                    sandboxMode: true
                },
                testUserId
            );

            expect(config).toBeDefined();
            expect(config.connector_key).toBe(testConnectorKey);
            expect(config.org_id).toBe(testOrgId);
        });

        it('should encrypt secrets before storage', async () => {
            const secrets = { apiKey: 'secret-key' };

            await ConnectorService.createConfig(
                testOrgId,
                testConnectorKey,
                { secrets },
                testUserId
            );

            const configs = await dbAll(
                'SELECT encrypted_secrets FROM org_connector_configs WHERE org_id = ?',
                [testOrgId]
            );

            expect(configs[0].encrypted_secrets).toBeDefined();
            expect(configs[0].encrypted_secrets).not.toContain('secret-key');
        });
    });

    describe('updateConfig', () => {
        it('should update existing configuration', async () => {
            // Create config first
            const configId = uuidv4();
            await dbRun(
                `INSERT INTO org_connector_configs 
                 (id, org_id, connector_key, status, scopes_json, configured_by, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                [configId, testOrgId, testConnectorKey, 'active', JSON.stringify(['read']), testUserId]
            );

            const updated = await ConnectorService.updateConfig(
                configId,
                { scopes: ['read', 'write', 'delete'] },
                testUserId
            );

            expect(updated.scopes).toContain('write');
        });
    });

    describe('deleteConfig', () => {
        it('should delete connector configuration', async () => {
            const configId = uuidv4();
            await dbRun(
                `INSERT INTO org_connector_configs 
                 (id, org_id, connector_key, status, configured_by, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                [configId, testOrgId, testConnectorKey, 'active', testUserId]
            );

            await ConnectorService.deleteConfig(configId, testUserId);

            const configs = await ConnectorService.getOrgConfigs(testOrgId);
            expect(configs.length).toBe(0);
        });
    });
});
