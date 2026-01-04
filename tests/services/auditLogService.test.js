/**
 * Audit Log Service Tests
 */

const auditLogService = require('../../../server/services/auditLogService');
const db = require('../../../server/database');

describe('AuditLogService', () => {
    beforeEach((done) => {
        // Clean up test data
        db.run('DELETE FROM audit_logs', [], () => {
            done();
        });
    });

    test('should create an audit log entry', async () => {
        const logData = {
            user_id: 'test-user',
            user_email: 'test@example.com',
            action_type: 'user.login',
            resource_type: 'user',
            risk_level: 'LOW'
        };

        const result = await auditLogService.createLog(logData);
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('timestamp');
    });

    test('should fetch audit logs with filters', async () => {
        // Create test logs
        await auditLogService.createLog({
            user_id: 'user1',
            action_type: 'user.login',
            resource_type: 'user',
            risk_level: 'LOW'
        });

        await auditLogService.createLog({
            user_id: 'user2',
            action_type: 'user.logout',
            resource_type: 'user',
            risk_level: 'HIGH'
        });

        const logs = await auditLogService.getLogs({ riskLevel: 'HIGH' }, { page: 1, pageSize: 10 });
        expect(logs.length).toBeGreaterThan(0);
        expect(logs[0].risk_level).toBe('HIGH');
    });

    test('should get audit log statistics', async () => {
        await auditLogService.createLog({
            user_id: 'user1',
            action_type: 'test',
            resource_type: 'test',
            risk_level: 'HIGH'
        });

        const stats = await auditLogService.getStats();
        expect(stats).toHaveProperty('total');
        expect(stats).toHaveProperty('high_risk');
    });
});









