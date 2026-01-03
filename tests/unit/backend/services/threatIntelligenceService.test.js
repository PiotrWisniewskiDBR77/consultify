/**
 * Unit tests for Threat Intelligence Service
 */

const { describe, it, expect, beforeEach, vi } = require('vitest');

// Mock database
const mockDb = {
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn()
};

// Import service
const threatIntelligenceService = require('../../../../server/services/threatIntelligenceService');

describe('ThreatIntelligenceService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        threatIntelligenceService.setDependencies({ db: mockDb });
    });

    describe('addThreat', () => {
        it('should add a new threat', async () => {
            mockDb.run.mockResolvedValue({ changes: 1 });

            const result = await threatIntelligenceService.addThreat({
                threatType: 'malicious_ip',
                source: 'Internal Detection',
                ipAddress: '192.168.1.100',
                reputationScore: 30,
                threatLevel: 'HIGH',
                description: 'Malicious activity detected'
            });

            expect(result).toBeDefined();
            expect(result.threatType).toBe('malicious_ip');
            expect(result.ipAddress).toBe('192.168.1.100');
            expect(result.threatLevel).toBe('HIGH');
            expect(result.reputationScore).toBe(30);
            expect(mockDb.run).toHaveBeenCalled();
        });

        it('should use default threat level if not provided', async () => {
            mockDb.run.mockResolvedValue({ changes: 1 });

            const result = await threatIntelligenceService.addThreat({
                threatType: 'spam_source',
                ipAddress: '10.0.0.1'
            });

            expect(result.threatLevel).toBe('MEDIUM');
        });
    });

    describe('getThreatById', () => {
        it('should return threat by ID', async () => {
            const mockThreat = {
                id: 'threat-123',
                threat_type: 'botnet',
                source: 'AbuseIPDB',
                ip_address: '192.168.1.1',
                domain: null,
                reputation_score: 15,
                threat_level: 'CRITICAL',
                description: 'Botnet activity',
                first_seen: '2024-01-01T10:00:00Z',
                last_seen: '2024-01-02T10:00:00Z',
                is_blocked: 1,
                created_at: '2024-01-01T10:00:00Z'
            };

            mockDb.get.mockResolvedValue(mockThreat);

            const result = await threatIntelligenceService.getThreatById('threat-123');

            expect(result).toBeDefined();
            expect(result.id).toBe('threat-123');
            expect(result.threatType).toBe('botnet');
            expect(result.ipAddress).toBe('192.168.1.1');
            expect(result.isBlocked).toBe(true);
        });

        it('should return null for non-existent threat', async () => {
            mockDb.get.mockResolvedValue(null);

            const result = await threatIntelligenceService.getThreatById('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('getThreats', () => {
        it('should return all threats', async () => {
            const mockThreats = [
                {
                    id: 'threat-1',
                    threat_type: 'malicious_ip',
                    source: 'Internal',
                    ip_address: '192.168.1.1',
                    domain: null,
                    reputation_score: 20,
                    threat_level: 'HIGH',
                    description: 'Test threat 1',
                    first_seen: '2024-01-01T10:00:00Z',
                    last_seen: '2024-01-01T10:00:00Z',
                    is_blocked: 0,
                    created_at: '2024-01-01T10:00:00Z'
                },
                {
                    id: 'threat-2',
                    threat_type: 'phishing',
                    source: 'External',
                    ip_address: null,
                    domain: 'malicious.com',
                    reputation_score: 5,
                    threat_level: 'CRITICAL',
                    description: 'Test threat 2',
                    first_seen: '2024-01-02T10:00:00Z',
                    last_seen: '2024-01-02T10:00:00Z',
                    is_blocked: 1,
                    created_at: '2024-01-02T10:00:00Z'
                }
            ];

            mockDb.all.mockResolvedValue(mockThreats);

            const result = await threatIntelligenceService.getThreats();

            expect(result).toHaveLength(2);
            expect(result[0].threatType).toBe('malicious_ip');
            expect(result[1].threatType).toBe('phishing');
        });

        it('should filter by threat type', async () => {
            mockDb.all.mockResolvedValue([]);

            await threatIntelligenceService.getThreats({ threatType: 'botnet' });

            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('threat_type = ?'),
                expect.arrayContaining(['botnet'])
            );
        });

        it('should filter by threat level', async () => {
            mockDb.all.mockResolvedValue([]);

            await threatIntelligenceService.getThreats({ threatLevel: 'CRITICAL' });

            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('threat_level = ?'),
                expect.arrayContaining(['CRITICAL'])
            );
        });

        it('should filter by blocked status', async () => {
            mockDb.all.mockResolvedValue([]);

            await threatIntelligenceService.getThreats({ isBlocked: true });

            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('is_blocked = ?'),
                expect.arrayContaining([1])
            );
        });
    });

    describe('checkIPReputation', () => {
        it('should return threat info for known IP', async () => {
            const mockThreat = {
                threat_type: 'malicious_ip',
                reputation_score: 10,
                threat_level: 'HIGH',
                is_blocked: 1,
                description: 'Known bad IP',
                first_seen: '2024-01-01T10:00:00Z',
                last_seen: '2024-01-02T10:00:00Z'
            };

            mockDb.get.mockResolvedValue(mockThreat);

            const result = await threatIntelligenceService.checkIPReputation('192.168.1.1');

            expect(result.found).toBe(true);
            expect(result.ipAddress).toBe('192.168.1.1');
            expect(result.threatLevel).toBe('HIGH');
            expect(result.isBlocked).toBe(true);
        });

        it('should return clean status for unknown IP', async () => {
            mockDb.get.mockResolvedValue(null);

            const result = await threatIntelligenceService.checkIPReputation('8.8.8.8');

            expect(result.found).toBe(false);
            expect(result.reputationScore).toBe(100);
            expect(result.threatLevel).toBe('CLEAN');
            expect(result.isBlocked).toBe(false);
        });
    });

    describe('checkDomainReputation', () => {
        it('should return threat info for known domain', async () => {
            const mockThreat = {
                threat_type: 'phishing',
                reputation_score: 5,
                threat_level: 'CRITICAL',
                is_blocked: 1,
                description: 'Phishing domain',
                first_seen: '2024-01-01T10:00:00Z',
                last_seen: '2024-01-02T10:00:00Z'
            };

            mockDb.get.mockResolvedValue(mockThreat);

            const result = await threatIntelligenceService.checkDomainReputation('malicious.com');

            expect(result.found).toBe(true);
            expect(result.domain).toBe('malicious.com');
            expect(result.threatLevel).toBe('CRITICAL');
            expect(result.isBlocked).toBe(true);
        });

        it('should return clean status for unknown domain', async () => {
            mockDb.get.mockResolvedValue(null);

            const result = await threatIntelligenceService.checkDomainReputation('google.com');

            expect(result.found).toBe(false);
            expect(result.reputationScore).toBe(100);
            expect(result.threatLevel).toBe('CLEAN');
            expect(result.isBlocked).toBe(false);
        });
    });

    describe('blockThreat', () => {
        it('should block a threat', async () => {
            mockDb.run.mockResolvedValue({ changes: 1 });

            const result = await threatIntelligenceService.blockThreat('threat-123');

            expect(result).toBe(true);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('is_blocked = 1'),
                ['threat-123']
            );
        });

        it('should return false if threat not found', async () => {
            mockDb.run.mockResolvedValue({ changes: 0 });

            const result = await threatIntelligenceService.blockThreat('non-existent');

            expect(result).toBe(false);
        });
    });

    describe('unblockThreat', () => {
        it('should unblock a threat', async () => {
            mockDb.run.mockResolvedValue({ changes: 1 });

            const result = await threatIntelligenceService.unblockThreat('threat-123');

            expect(result).toBe(true);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('is_blocked = 0'),
                ['threat-123']
            );
        });
    });

    describe('updateThreat', () => {
        it('should update allowed fields', async () => {
            mockDb.run.mockResolvedValue({ changes: 1 });

            const result = await threatIntelligenceService.updateThreat('threat-123', {
                threatLevel: 'CRITICAL',
                description: 'Updated description'
            });

            expect(result).toBe(true);
        });

        it('should return false if no allowed fields provided', async () => {
            const result = await threatIntelligenceService.updateThreat('threat-123', {
                notAllowed: 'value'
            });

            expect(result).toBe(false);
        });
    });

    describe('deleteThreat', () => {
        it('should delete a threat', async () => {
            mockDb.run.mockResolvedValue({ changes: 1 });

            const result = await threatIntelligenceService.deleteThreat('threat-123');

            expect(result).toBe(true);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM threat_intelligence'),
                ['threat-123']
            );
        });

        it('should return false if threat not found', async () => {
            mockDb.run.mockResolvedValue({ changes: 0 });

            const result = await threatIntelligenceService.deleteThreat('non-existent');

            expect(result).toBe(false);
        });
    });

    describe('getStats', () => {
        it('should return threat statistics', async () => {
            const mockStats = {
                total_threats: 100,
                blocked_count: 30,
                critical_count: 10,
                high_count: 25,
                medium_count: 40,
                low_count: 25,
                ip_count: 70,
                domain_count: 30,
                avg_reputation: 35.5
            };

            mockDb.get.mockResolvedValue(mockStats);

            const result = await threatIntelligenceService.getStats();

            expect(result.totalThreats).toBe(100);
            expect(result.blockedCount).toBe(30);
            expect(result.byThreatLevel.critical).toBe(10);
            expect(result.byThreatLevel.high).toBe(25);
            expect(result.byThreatLevel.medium).toBe(40);
            expect(result.byThreatLevel.low).toBe(25);
            expect(result.ipCount).toBe(70);
            expect(result.domainCount).toBe(30);
            expect(result.avgReputation).toBe(36); // Rounded
        });

        it('should return zeros when no data', async () => {
            mockDb.get.mockResolvedValue(null);

            const result = await threatIntelligenceService.getStats();

            expect(result.totalThreats).toBe(0);
            expect(result.blockedCount).toBe(0);
            expect(result.byThreatLevel.critical).toBe(0);
        });
    });

    describe('getBlockedIPs', () => {
        it('should return list of blocked IPs', async () => {
            const mockBlockedIPs = [
                { ip_address: '192.168.1.1', threat_level: 'HIGH', reputation_score: 10, description: 'Bad IP 1' },
                { ip_address: '10.0.0.1', threat_level: 'CRITICAL', reputation_score: 5, description: 'Bad IP 2' }
            ];

            mockDb.all.mockResolvedValue(mockBlockedIPs);

            const result = await threatIntelligenceService.getBlockedIPs();

            expect(result).toHaveLength(2);
            expect(result[0].ipAddress).toBe('192.168.1.1');
            expect(result[1].ipAddress).toBe('10.0.0.1');
        });
    });

    describe('getBlockedDomains', () => {
        it('should return list of blocked domains', async () => {
            const mockBlockedDomains = [
                { domain: 'malicious.com', threat_level: 'HIGH', reputation_score: 10, description: 'Bad domain 1' },
                { domain: 'phishing.net', threat_level: 'CRITICAL', reputation_score: 5, description: 'Bad domain 2' }
            ];

            mockDb.all.mockResolvedValue(mockBlockedDomains);

            const result = await threatIntelligenceService.getBlockedDomains();

            expect(result).toHaveLength(2);
            expect(result[0].domain).toBe('malicious.com');
            expect(result[1].domain).toBe('phishing.net');
        });
    });

    describe('bulkImport', () => {
        it('should import multiple threats', async () => {
            mockDb.run.mockResolvedValue({ changes: 1 });

            const threats = [
                { threatType: 'malicious_ip', ipAddress: '192.168.1.1' },
                { threatType: 'phishing', domain: 'bad.com' },
                { threatType: 'spam_source', ipAddress: '10.0.0.1' }
            ];

            const result = await threatIntelligenceService.bulkImport(threats);

            expect(result.imported).toBe(3);
            expect(result.failed).toBe(0);
            expect(result.total).toBe(3);
        });
    });

    describe('constants', () => {
        it('should export threat levels', () => {
            expect(threatIntelligenceService.THREAT_LEVELS).toBeDefined();
            expect(threatIntelligenceService.THREAT_LEVELS.LOW).toBe('LOW');
            expect(threatIntelligenceService.THREAT_LEVELS.MEDIUM).toBe('MEDIUM');
            expect(threatIntelligenceService.THREAT_LEVELS.HIGH).toBe('HIGH');
            expect(threatIntelligenceService.THREAT_LEVELS.CRITICAL).toBe('CRITICAL');
        });

        it('should export threat types', () => {
            expect(threatIntelligenceService.THREAT_TYPES).toBeDefined();
            expect(threatIntelligenceService.THREAT_TYPES.MALICIOUS_IP).toBe('malicious_ip');
            expect(threatIntelligenceService.THREAT_TYPES.BOTNET).toBe('botnet');
            expect(threatIntelligenceService.THREAT_TYPES.PHISHING).toBe('phishing');
        });
    });
});




