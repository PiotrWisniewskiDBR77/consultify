/**
 * Unit tests for Security Incident Service
 */

const { describe, it, expect, beforeEach, vi } = require('vitest');

// Mock database
const mockDb = {
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn()
};

// Import service
const securityIncidentService = require('../../../../server/services/securityIncidentService');

describe('SecurityIncidentService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        securityIncidentService.setDependencies({ db: mockDb });
    });

    describe('createIncident', () => {
        it('should create a new security incident', async () => {
            mockDb.run.mockResolvedValue({ changes: 1 });

            const result = await securityIncidentService.createIncident({
                incidentType: 'unauthorized_access',
                severity: 'HIGH',
                description: 'Unauthorized access attempt detected',
                affectedResources: ['server-1', 'database-prod']
            });

            expect(result).toBeDefined();
            expect(result.incidentType).toBe('unauthorized_access');
            expect(result.severity).toBe('HIGH');
            expect(result.status).toBe('open');
            expect(result.description).toBe('Unauthorized access attempt detected');
            expect(result.affectedResources).toEqual(['server-1', 'database-prod']);
            expect(mockDb.run).toHaveBeenCalled();
        });

        it('should use default severity if not provided', async () => {
            mockDb.run.mockResolvedValue({ changes: 1 });

            const result = await securityIncidentService.createIncident({
                incidentType: 'suspicious_activity',
                description: 'Suspicious activity detected'
            });

            expect(result.severity).toBe('MEDIUM');
        });
    });

    describe('getIncidentById', () => {
        it('should return incident by ID', async () => {
            const mockIncident = {
                id: 'inc-123',
                incident_type: 'data_breach',
                severity: 'CRITICAL',
                status: 'open',
                description: 'Data breach detected',
                affected_resources_json: '["database-1"]',
                detected_at: '2024-01-01T10:00:00Z',
                resolved_at: null,
                resolution_notes: null,
                created_at: '2024-01-01T10:00:00Z',
                resolved_by: null
            };

            mockDb.get.mockResolvedValue(mockIncident);

            const result = await securityIncidentService.getIncidentById('inc-123');

            expect(result).toBeDefined();
            expect(result.id).toBe('inc-123');
            expect(result.incidentType).toBe('data_breach');
            expect(result.severity).toBe('CRITICAL');
            expect(result.affectedResources).toEqual(['database-1']);
        });

        it('should return null for non-existent incident', async () => {
            mockDb.get.mockResolvedValue(null);

            const result = await securityIncidentService.getIncidentById('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('getIncidents', () => {
        it('should return all incidents', async () => {
            const mockIncidents = [
                {
                    id: 'inc-1',
                    incident_type: 'unauthorized_access',
                    severity: 'HIGH',
                    status: 'open',
                    description: 'Test incident 1',
                    affected_resources_json: '[]',
                    detected_at: '2024-01-01T10:00:00Z',
                    resolved_at: null,
                    resolution_notes: null,
                    created_at: '2024-01-01T10:00:00Z',
                    resolved_by: null
                },
                {
                    id: 'inc-2',
                    incident_type: 'phishing',
                    severity: 'MEDIUM',
                    status: 'resolved',
                    description: 'Test incident 2',
                    affected_resources_json: '["email-server"]',
                    detected_at: '2024-01-02T10:00:00Z',
                    resolved_at: '2024-01-02T12:00:00Z',
                    resolution_notes: 'Blocked phishing emails',
                    created_at: '2024-01-02T10:00:00Z',
                    resolved_by: 'user-1'
                }
            ];

            mockDb.all.mockResolvedValue(mockIncidents);

            const result = await securityIncidentService.getIncidents();

            expect(result).toHaveLength(2);
            expect(result[0].incidentType).toBe('unauthorized_access');
            expect(result[1].incidentType).toBe('phishing');
        });

        it('should filter by status', async () => {
            mockDb.all.mockResolvedValue([]);

            await securityIncidentService.getIncidents({ status: 'open' });

            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('si.status = ?'),
                expect.arrayContaining(['open'])
            );
        });

        it('should filter by severity', async () => {
            mockDb.all.mockResolvedValue([]);

            await securityIncidentService.getIncidents({ severity: 'CRITICAL' });

            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('si.severity = ?'),
                expect.arrayContaining(['CRITICAL'])
            );
        });

        it('should filter by incident type', async () => {
            mockDb.all.mockResolvedValue([]);

            await securityIncidentService.getIncidents({ incidentType: 'malware' });

            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('si.incident_type = ?'),
                expect.arrayContaining(['malware'])
            );
        });
    });

    describe('updateIncidentStatus', () => {
        it('should update incident status', async () => {
            mockDb.run.mockResolvedValue({ changes: 1 });

            const result = await securityIncidentService.updateIncidentStatus('inc-123', 'in_progress');

            expect(result).toBe(true);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE security_incidents SET status'),
                ['in_progress', 'inc-123']
            );
        });

        it('should return false if incident not found', async () => {
            mockDb.run.mockResolvedValue({ changes: 0 });

            const result = await securityIncidentService.updateIncidentStatus('non-existent', 'resolved');

            expect(result).toBe(false);
        });
    });

    describe('resolveIncident', () => {
        it('should resolve an incident', async () => {
            mockDb.run.mockResolvedValue({ changes: 1 });

            const result = await securityIncidentService.resolveIncident(
                'inc-123',
                'admin-1',
                'Incident resolved by security team'
            );

            expect(result).toBe(true);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('resolved'),
                expect.arrayContaining(['resolved', 'admin-1', 'Incident resolved by security team', 'inc-123'])
            );
        });
    });

    describe('updateIncident', () => {
        it('should update allowed fields', async () => {
            mockDb.run.mockResolvedValue({ changes: 1 });

            const result = await securityIncidentService.updateIncident('inc-123', {
                severity: 'CRITICAL',
                description: 'Updated description'
            });

            expect(result).toBe(true);
        });

        it('should return false if no allowed fields provided', async () => {
            const result = await securityIncidentService.updateIncident('inc-123', {
                notAllowed: 'value'
            });

            expect(result).toBe(false);
        });
    });

    describe('deleteIncident', () => {
        it('should delete an incident', async () => {
            mockDb.run.mockResolvedValue({ changes: 1 });

            const result = await securityIncidentService.deleteIncident('inc-123');

            expect(result).toBe(true);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM security_incidents'),
                ['inc-123']
            );
        });

        it('should return false if incident not found', async () => {
            mockDb.run.mockResolvedValue({ changes: 0 });

            const result = await securityIncidentService.deleteIncident('non-existent');

            expect(result).toBe(false);
        });
    });

    describe('getStats', () => {
        it('should return incident statistics', async () => {
            const mockStats = {
                total_incidents: 10,
                open_count: 3,
                in_progress_count: 2,
                resolved_count: 4,
                closed_count: 1,
                critical_count: 1,
                high_count: 3,
                medium_count: 4,
                low_count: 2
            };

            mockDb.get.mockResolvedValue(mockStats);

            const result = await securityIncidentService.getStats();

            expect(result.totalIncidents).toBe(10);
            expect(result.byStatus.open).toBe(3);
            expect(result.byStatus.inProgress).toBe(2);
            expect(result.byStatus.resolved).toBe(4);
            expect(result.byStatus.closed).toBe(1);
            expect(result.bySeverity.critical).toBe(1);
            expect(result.bySeverity.high).toBe(3);
            expect(result.bySeverity.medium).toBe(4);
            expect(result.bySeverity.low).toBe(2);
        });

        it('should return zeros when no data', async () => {
            mockDb.get.mockResolvedValue(null);

            const result = await securityIncidentService.getStats();

            expect(result.totalIncidents).toBe(0);
            expect(result.byStatus.open).toBe(0);
            expect(result.bySeverity.critical).toBe(0);
        });
    });

    describe('constants', () => {
        it('should export severity levels', () => {
            expect(securityIncidentService.SEVERITY).toBeDefined();
            expect(securityIncidentService.SEVERITY.LOW).toBe('LOW');
            expect(securityIncidentService.SEVERITY.MEDIUM).toBe('MEDIUM');
            expect(securityIncidentService.SEVERITY.HIGH).toBe('HIGH');
            expect(securityIncidentService.SEVERITY.CRITICAL).toBe('CRITICAL');
        });

        it('should export status types', () => {
            expect(securityIncidentService.STATUS).toBeDefined();
            expect(securityIncidentService.STATUS.OPEN).toBe('open');
            expect(securityIncidentService.STATUS.IN_PROGRESS).toBe('in_progress');
            expect(securityIncidentService.STATUS.RESOLVED).toBe('resolved');
            expect(securityIncidentService.STATUS.CLOSED).toBe('closed');
        });

        it('should export incident types', () => {
            expect(securityIncidentService.INCIDENT_TYPES).toBeDefined();
            expect(securityIncidentService.INCIDENT_TYPES.UNAUTHORIZED_ACCESS).toBe('unauthorized_access');
            expect(securityIncidentService.INCIDENT_TYPES.DATA_BREACH).toBe('data_breach');
            expect(securityIncidentService.INCIDENT_TYPES.MALWARE).toBe('malware');
        });
    });
});




