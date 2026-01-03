/**
 * Feature Flag Service Tests
 */

const featureFlagService = require('../../../server/services/featureFlagService');
const db = require('../../../server/database');

describe('FeatureFlagService', () => {
    beforeEach((done) => {
        db.run('DELETE FROM feature_flags', [], () => {
            db.run('DELETE FROM feature_flag_history', [], () => {
                done();
            });
        });
    });

    test('should create a feature flag', async () => {
        const flagData = {
            flag_key: 'test_feature',
            name: 'Test Feature',
            enabled: true,
            flag_type: 'boolean',
            environment: 'production',
            created_by: 'test-user'
        };

        const result = await featureFlagService.createFlag(flagData);
        expect(result).toHaveProperty('id');
        expect(result.flag_key).toBe('test_feature');
    });

    test('should evaluate feature flag correctly', async () => {
        await featureFlagService.createFlag({
            flag_key: 'test_flag',
            name: 'Test',
            enabled: true,
            flag_type: 'boolean',
            environment: 'production',
            created_by: 'test-user'
        });

        const enabled = await featureFlagService.isEnabled('test_flag', {}, 'production');
        expect(enabled).toBe(true);
    });

    test('should update feature flag', async () => {
        const flag = await featureFlagService.createFlag({
            flag_key: 'update_test',
            name: 'Update Test',
            enabled: false,
            flag_type: 'boolean',
            environment: 'production',
            created_by: 'test-user'
        });

        const updated = await featureFlagService.updateFlag(flag.id, {
            enabled: true,
            updated_by: 'test-user'
        });

        expect(updated.enabled).toBe(true);
    });
});







