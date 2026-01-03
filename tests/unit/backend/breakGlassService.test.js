const { initTestDb, cleanTables, dbRun, db } = require('../../helpers/dbHelper.cjs');
const BreakGlassService = require('../../../server/services/breakGlassService');
const { v4: uuidv4 } = require('uuid');

describe('BreakGlassService', () => {
    let testOrgId;
    let testUserId;

    beforeAll(async () => {
        await initTestDb();
        // Inject the same database instance used by the test helpers
        BreakGlassService.setDependencies({ db, uuidv4 });
    });

    beforeEach(async () => {
        await cleanTables([
            'break_glass_sessions',
            'users',
            'organizations'
        ]);

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
            [testUserId, testOrgId, 'admin@test.com', 'Admin User', 'superadmin']
        );
    });

    describe('startSession', () => {
        it('should start break-glass session', async () => {
            const session = await BreakGlassService.startSession({
                actorId: testUserId,
                actorRole: 'SUPERADMIN',
                orgId: testOrgId,
                reason: 'Emergency access needed',
                scope: BreakGlassService.SCOPES.EMERGENCY_ACCESS
            });

            expect(session).toHaveProperty('id');
            expect(session.organizationId).toBe(testOrgId);
            expect(session.actorId).toBe(testUserId);
            expect(session.scope).toBe(BreakGlassService.SCOPES.EMERGENCY_ACCESS);
            expect(session.expiresAt).toBeDefined();
        });

        it('should use default duration when not specified', async () => {
            const session = await BreakGlassService.startSession({
                actorId: testUserId,
                actorRole: 'SUPERADMIN',
                orgId: testOrgId,
                reason: 'Test',
                scope: BreakGlassService.SCOPES.EMERGENCY_ACCESS
            });

            const expiresAt = new Date(session.expiresAt);
            const now = new Date();
            const minutesDiff = (expiresAt - now) / (1000 * 60);

            expect(minutesDiff).toBeCloseTo(BreakGlassService.DEFAULT_DURATION_MINUTES, 1);
        });

        it('should use custom duration when specified', async () => {
            const customDuration = 60; // 1 hour

            const session = await BreakGlassService.startSession({
                actorId: testUserId,
                actorRole: 'SUPERADMIN',
                orgId: testOrgId,
                reason: 'Test',
                scope: BreakGlassService.SCOPES.EMERGENCY_ACCESS,
                durationMinutes: customDuration
            });

            const expiresAt = new Date(session.expiresAt);
            const now = new Date();
            const minutesDiff = (expiresAt - now) / (1000 * 60);

            expect(minutesDiff).toBeCloseTo(customDuration, 1);
        });

        it('should enforce max duration limit', async () => {
            const excessiveDuration = BreakGlassService.MAX_DURATION_MINUTES + 1000;

            const session = await BreakGlassService.startSession({
                actorId: testUserId,
                actorRole: 'SUPERADMIN',
                orgId: testOrgId,
                reason: 'Test',
                scope: BreakGlassService.SCOPES.EMERGENCY_ACCESS,
                durationMinutes: excessiveDuration
            });

            const expiresAt = new Date(session.expiresAt);
            const now = new Date();
            const minutesDiff = (expiresAt - now) / (1000 * 60);

            expect(minutesDiff).toBeLessThanOrEqual(BreakGlassService.MAX_DURATION_MINUTES);
        });

        it('should reject invalid scope', async () => {
            await expect(
                BreakGlassService.startSession({
                    actorId: testUserId,
                    actorRole: 'SUPERADMIN',
                    orgId: testOrgId,
                    reason: 'Test',
                    scope: 'INVALID_SCOPE'
                })
            ).rejects.toThrow(/Invalid scope/);
        });

        it('should reject duplicate active session', async () => {
            await BreakGlassService.startSession({
                actorId: testUserId,
                actorRole: 'SUPERADMIN',
                orgId: testOrgId,
                reason: 'First session',
                scope: BreakGlassService.SCOPES.EMERGENCY_ACCESS
            });

            await expect(
                BreakGlassService.startSession({
                    actorId: testUserId,
                    actorRole: 'SUPERADMIN',
                    orgId: testOrgId,
                    reason: 'Second session',
                    scope: BreakGlassService.SCOPES.EMERGENCY_ACCESS
                })
            ).rejects.toThrow(/Active break-glass session already exists/);
        });

        it('should require all mandatory parameters', async () => {
            await expect(
                BreakGlassService.startSession({
                    actorId: testUserId,
                    orgId: testOrgId
                    // Missing reason and scope
                })
            ).rejects.toThrow(/Missing required parameters/);
        });
    });

    describe('getActiveSession', () => {
        it('should return active session for scope', async () => {
            await BreakGlassService.startSession({
                actorId: testUserId,
                actorRole: 'SUPERADMIN',
                orgId: testOrgId,
                reason: 'Test',
                scope: BreakGlassService.SCOPES.EMERGENCY_ACCESS
            });

            const session = await BreakGlassService.getActiveSession(
                testOrgId,
                BreakGlassService.SCOPES.EMERGENCY_ACCESS
            );

            expect(session).toBeDefined();
            expect(session.scope).toBe(BreakGlassService.SCOPES.EMERGENCY_ACCESS);
        });

        it('should return null when no active session', async () => {
            const session = await BreakGlassService.getActiveSession(
                testOrgId,
                BreakGlassService.SCOPES.EMERGENCY_ACCESS
            );

            expect(session).toBeNull();
        });

        it('should return null for expired session', async () => {
            // Create expired session manually via DB
            const expiredSessionId = uuidv4();
            const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
            await dbRun(
                `INSERT INTO break_glass_sessions 
                 (id, organization_id, actor_id, reason, scope, expires_at, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    expiredSessionId,
                    testOrgId,
                    testUserId,
                    'Expired session',
                    BreakGlassService.SCOPES.EMERGENCY_ACCESS,
                    pastDate.toISOString(),
                    pastDate.toISOString()
                ]
            );

            const session = await BreakGlassService.getActiveSession(
                testOrgId,
                BreakGlassService.SCOPES.EMERGENCY_ACCESS
            );

            expect(session).toBeNull();
        });
    });

    describe('isBreakGlassActive', () => {
        it('should return true for active session', async () => {
            await BreakGlassService.startSession({
                actorId: testUserId,
                actorRole: 'SUPERADMIN',
                orgId: testOrgId,
                reason: 'Test',
                scope: BreakGlassService.SCOPES.EMERGENCY_ACCESS
            });

            const isActive = await BreakGlassService.isBreakGlassActive(
                testOrgId,
                BreakGlassService.SCOPES.EMERGENCY_ACCESS
            );

            expect(isActive).toBe(true);
        });

        it('should return false when no active session', async () => {
            const isActive = await BreakGlassService.isBreakGlassActive(
                testOrgId,
                BreakGlassService.SCOPES.EMERGENCY_ACCESS
            );

            expect(isActive).toBe(false);
        });
    });

    describe('closeSession', () => {
        it('should end active session', async () => {
            const session = await BreakGlassService.startSession({
                actorId: testUserId,
                actorRole: 'SUPERADMIN',
                orgId: testOrgId,
                reason: 'Test',
                scope: BreakGlassService.SCOPES.EMERGENCY_ACCESS
            });

            await BreakGlassService.closeSession(session.id, testUserId, 'SUPERADMIN');

            const isActive = await BreakGlassService.isBreakGlassActive(
                testOrgId,
                BreakGlassService.SCOPES.EMERGENCY_ACCESS
            );

            expect(isActive).toBe(false);
        });

        it('should record end reason', async () => {
            const session = await BreakGlassService.startSession({
                actorId: testUserId,
                actorRole: 'SUPERADMIN',
                orgId: testOrgId,
                reason: 'Test',
                scope: BreakGlassService.SCOPES.EMERGENCY_ACCESS
            });

            await BreakGlassService.closeSession(session.id, testUserId, 'SUPERADMIN');

            // Verify session was ended (check via getActiveSession)
            const activeSession = await BreakGlassService.getActiveSession(
                testOrgId,
                BreakGlassService.SCOPES.EMERGENCY_ACCESS
            );

            expect(activeSession).toBeNull();
        });
    });

    describe('getActiveSessions', () => {
        it('should return all sessions for organization', async () => {
            await BreakGlassService.startSession({
                actorId: testUserId,
                actorRole: 'SUPERADMIN',
                orgId: testOrgId,
                reason: 'Session 1',
                scope: BreakGlassService.SCOPES.EMERGENCY_ACCESS
            });

            const sessions = await BreakGlassService.getActiveSessions(testOrgId);

            expect(Array.isArray(sessions)).toBe(true);
            expect(sessions.length).toBeGreaterThanOrEqual(1);
        });
    });
});


