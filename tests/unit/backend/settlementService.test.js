/**
 * Settlement Service Tests
 * 
 * CRITICAL BILLING SERVICE - Must have 95%+ coverage
 * Tests settlement periods, calculations, locking, and immutability.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockDb } from '../../helpers/dependencyInjector.js';

describe('SettlementService', () => {
    let mockDb;
    let SettlementService;
    let mockAttributionService;
    let mockPartnerService;
    let mockMetricsCollector;

    beforeEach(async () => {
        vi.resetModules();
        
        mockDb = createMockDb();

        mockAttributionService = {
            exportAttribution: vi.fn().mockResolvedValue([])
        };

        mockPartnerService = {
            getByPartnerCode: vi.fn().mockResolvedValue(null),
            getActiveAgreement: vi.fn().mockResolvedValue({
                revenue_share_percent: 20
            }),
            getPartner: vi.fn().mockResolvedValue({
                id: 'partner-1',
                name: 'Test Partner',
                partnerType: 'AFFILIATE'
            })
        };

        mockMetricsCollector = {
            recordEvent: vi.fn().mockResolvedValue({}),
            EVENT_TYPES: {
                SETTLEMENT_GENERATED: 'SETTLEMENT_GENERATED'
            },
            SOURCE_TYPES: {
                PARTNER: 'PARTNER'
            }
        };

        SettlementService = (await import('../../../server/services/settlementService.js')).default;
        
        SettlementService.setDependencies({
            db: mockDb,
            uuidv4: () => 'settlement-1',
            AttributionService: mockAttributionService,
            PartnerService: mockPartnerService,
            MetricsCollector: mockMetricsCollector
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('createPeriod()', () => {
        it('should create a new settlement period', async () => {
            const periodStart = '2024-01-01T00:00:00Z';
            const periodEnd = '2024-01-31T23:59:59Z';

            // Mock no overlapping periods
            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('status = ?')) {
                    // getOpenPeriod - no open period
                    callback(null, null);
                } else {
                    // checkOverlappingPeriod - no overlap
                    callback(null, null);
                }
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const period = await SettlementService.createPeriod({ periodStart, periodEnd });

            expect(period.id).toBeDefined();
            expect(period.periodStart).toBe(periodStart);
            expect(period.periodEnd).toBe(periodEnd);
            expect(period.status).toBe(SettlementService.PERIOD_STATUS.OPEN);
        });

        it('should reject missing periodStart', async () => {
            await expect(
                SettlementService.createPeriod({ periodEnd: '2024-01-31T23:59:59Z' })
            ).rejects.toMatchObject({
                errorCode: 'MISSING_REQUIRED'
            });
        });

        it('should reject missing periodEnd', async () => {
            await expect(
                SettlementService.createPeriod({ periodStart: '2024-01-01T00:00:00Z' })
            ).rejects.toMatchObject({
                errorCode: 'MISSING_REQUIRED'
            });
        });

        it('should reject invalid date range', async () => {
            const periodStart = '2024-01-31T23:59:59Z';
            const periodEnd = '2024-01-01T00:00:00Z';

            await expect(
                SettlementService.createPeriod({ periodStart, periodEnd })
            ).rejects.toMatchObject({
                errorCode: 'INVALID_DATE_RANGE'
            });
        });

        it('should reject overlapping periods', async () => {
            const periodStart = '2024-01-01T00:00:00Z';
            const periodEnd = '2024-01-31T23:59:59Z';

            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('status = ?')) {
                    callback(null, null);
                } else {
                    // Overlapping period found
                    callback(null, { id: 'period-existing' });
                }
            });

            await expect(
                SettlementService.createPeriod({ periodStart, periodEnd })
            ).rejects.toMatchObject({
                errorCode: 'PERIOD_OVERLAP'
            });
        });

        it('should reject when open period exists', async () => {
            const periodStart = '2024-01-01T00:00:00Z';
            const periodEnd = '2024-01-31T23:59:59Z';

            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('status = ?')) {
                    // Open period exists
                    callback(null, { id: 'period-open' });
                } else {
                    callback(null, null);
                }
            });

            await expect(
                SettlementService.createPeriod({ periodStart, periodEnd })
            ).rejects.toMatchObject({
                errorCode: 'OPEN_PERIOD_EXISTS'
            });
        });
    });

    describe('getPeriod()', () => {
        it('should return period by ID', async () => {
            const periodId = 'period-123';
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    id: periodId,
                    period_start: '2024-01-01T00:00:00Z',
                    period_end: '2024-01-31T23:59:59Z',
                    status: SettlementService.PERIOD_STATUS.OPEN
                });
            });

            const period = await SettlementService.getPeriod(periodId);

            expect(period.id).toBe(periodId);
            expect(period.status).toBe(SettlementService.PERIOD_STATUS.OPEN);
        });

        it('should return null for non-existent period', async () => {
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, null);
            });

            const period = await SettlementService.getPeriod('non-existent');
            expect(period).toBeNull();
        });
    });

    describe('getOpenPeriod()', () => {
        it('should return open period', async () => {
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    id: 'period-open',
                    period_start: '2024-01-01T00:00:00Z',
                    period_end: '2024-01-31T23:59:59Z',
                    status: SettlementService.PERIOD_STATUS.OPEN
                });
            });

            const period = await SettlementService.getOpenPeriod();

            expect(period).toBeDefined();
            expect(period.status).toBe(SettlementService.PERIOD_STATUS.OPEN);
        });

        it('should return null when no open period', async () => {
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, null);
            });

            const period = await SettlementService.getOpenPeriod();
            expect(period).toBeNull();
        });
    });

    describe('calculateSettlements()', () => {
        it('should calculate settlements for open period', async () => {
            const periodId = 'period-123';
            const calculatedByUserId = 'user-123';

            // Mock getPeriod - this is called first in calculateSettlements
            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('settlement_periods') && query.includes('sp.id')) {
                    // getPeriod query with JOIN
                    callback(null, {
                        id: periodId,
                        period_start: '2024-01-01T00:00:00Z',
                        period_end: '2024-01-31T23:59:59Z',
                        status: SettlementService.PERIOD_STATUS.OPEN,
                        calculated_at: null,
                        calculated_by: null,
                        locked_at: null,
                        locked_by: null,
                        total_revenue: 0,
                        total_settlements: 0,
                        partner_count: 0,
                        created_at: '2024-01-01T00:00:00Z'
                    });
                } else if (query.includes('organization_billing')) {
                    // Mock getRevenueForAttribution
                    callback(null, { price_monthly: 100 });
                } else {
                    callback(null, null);
                }
            });

            // Reset mock to return empty array (no attributions)
            mockAttributionService.exportAttribution.mockResolvedValue([]);
            mockPartnerService.getByPartnerCode = vi.fn().mockResolvedValue(null);
            mockPartnerService.getActiveAgreement = vi.fn().mockResolvedValue(null);
            mockMetricsCollector.recordEvent = vi.fn().mockResolvedValue({});
            mockMetricsCollector.EVENT_TYPES = { SETTLEMENT_GENERATED: 'SETTLEMENT_GENERATED' };
            mockMetricsCollector.SOURCE_TYPES = { PARTNER: 'PARTNER' };

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await SettlementService.calculateSettlements(periodId, calculatedByUserId);

            expect(result.periodId).toBe(periodId);
            expect(result.status).toBe(SettlementService.PERIOD_STATUS.CALCULATED);
            expect(result.settlementCount).toBe(0);
            expect(result.partnerCount).toBe(0);
        });

        it('should reject calculation for locked period', async () => {
            const periodId = 'period-locked';
            const calculatedByUserId = 'user-123';

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    id: periodId,
                    status: SettlementService.PERIOD_STATUS.LOCKED
                });
            });

            await expect(
                SettlementService.calculateSettlements(periodId, calculatedByUserId)
            ).rejects.toMatchObject({
                errorCode: 'PERIOD_LOCKED'
            });
        });

        it('should reject calculation for non-existent period', async () => {
            const periodId = 'non-existent';
            const calculatedByUserId = 'user-123';

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, null);
            });

            await expect(
                SettlementService.calculateSettlements(periodId, calculatedByUserId)
            ).rejects.toMatchObject({
                errorCode: 'NOT_FOUND'
            });
        });
    });

    describe('lockPeriod()', () => {
        it('should lock a calculated period', async () => {
            const periodId = 'period-123';
            const lockedByUserId = 'user-123';

            // Mock period
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    id: periodId,
                    status: SettlementService.PERIOD_STATUS.CALCULATED
                });
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await SettlementService.lockPeriod(periodId, lockedByUserId);

            expect(result.periodId).toBe(periodId);
            expect(result.status).toBe(SettlementService.PERIOD_STATUS.LOCKED);
            expect(result.alreadyLocked).toBe(false);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE settlement_periods SET'),
                expect.any(Array),
                expect.any(Function)
            );
        });

        it('should reject locking open period', async () => {
            const periodId = 'period-open';
            const lockedByUserId = 'user-123';

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    id: periodId,
                    status: SettlementService.PERIOD_STATUS.OPEN
                });
            });

            await expect(
                SettlementService.lockPeriod(periodId, lockedByUserId)
            ).rejects.toMatchObject({
                errorCode: 'NOT_CALCULATED'
            });
        });

        it('should return already locked status for already locked period', async () => {
            const periodId = 'period-locked';
            const lockedByUserId = 'user-123';
            const lockedAt = '2024-01-15T00:00:00Z';
            const lockedBy = 'user-456';

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    id: periodId,
                    status: SettlementService.PERIOD_STATUS.LOCKED,
                    locked_at: lockedAt,
                    locked_by: lockedBy
                });
            });

            const result = await SettlementService.lockPeriod(periodId, lockedByUserId);

            expect(result.periodId).toBe(periodId);
            expect(result.status).toBe(SettlementService.PERIOD_STATUS.LOCKED);
            expect(result.alreadyLocked).toBe(true);
            expect(result.lockedAt).toBe(lockedAt);
            expect(result.lockedBy).toBe(lockedBy);
        });
    });

    describe('listPeriods()', () => {
        it('should return list of periods', async () => {
            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, [
                    {
                        id: 'period-1',
                        period_start: '2024-01-01T00:00:00Z',
                        period_end: '2024-01-31T23:59:59Z',
                        status: SettlementService.PERIOD_STATUS.LOCKED
                    },
                    {
                        id: 'period-2',
                        period_start: '2024-02-01T00:00:00Z',
                        period_end: '2024-02-29T23:59:59Z',
                        status: SettlementService.PERIOD_STATUS.CALCULATED
                    }
                ]);
            });

            const periods = await SettlementService.listPeriods();

            expect(periods).toHaveLength(2);
            expect(periods[0].id).toBe('period-1');
        });

        it('should handle empty list', async () => {
            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, []);
            });

            const periods = await SettlementService.listPeriods();
            expect(periods).toEqual([]);
        });
    });

    describe('Immutability', () => {
        it('should prevent modifications to locked period', async () => {
            const periodId = 'period-locked';

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    id: periodId,
                    status: SettlementService.PERIOD_STATUS.LOCKED
                });
            });

            // Try to recalculate locked period
            await expect(
                SettlementService.calculateSettlements(periodId, 'user-123')
            ).rejects.toMatchObject({
                errorCode: 'PERIOD_LOCKED'
            });
        });
    });
});

