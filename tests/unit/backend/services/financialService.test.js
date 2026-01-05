/**
 * Financial Service Tests
 *
 * Tests for financial calculations, cost estimation, and portfolio simulation.
 * Critical business logic for initiative valuation and ROI calculations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockDb, createMockLogger } from '../../../helpers/mockDb.js';
import { InitiativeFinancialService } from '../../../../server/src/services/initiative/InitiativeFinancialService.js';

let financialService;

describe('FinancialService', () => {
    let mockDb;
    let mockLogger;

    beforeEach(async () => {
        // Use mock setup
        mockDb = createMockDb();
        mockLogger = createMockLogger();

        // Create service instance with mocked dependencies
        financialService = new InitiativeFinancialService({ db: mockDb });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('updateFinancials()', () => {
        it('should update financials for an initiative', async () => {
            const initiativeId = 'init-123';
            const capex = 10000;
            const opex = 5000;
            const expectedRoi = 15.5;

            vi.mocked(mockDb.run).mockImplementationOnce(() => Promise.resolve({ changes: 1 }));

            const result = await financialService.updateFinancials(initiativeId, capex, opex, expectedRoi);

            expect(result).toBe(true);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE initiatives'),
                [capex, opex, expectedRoi, initiativeId]
            );
        });

        it('should return false when initiative does not exist', async () => {
            const initiativeId = 'non-existent';
            vi.mocked(mockDb.run).mockImplementationOnce(() => Promise.resolve({ changes: 0 }));

            const result = await financialService.updateFinancials(initiativeId, 1000, 500, 10);
            expect(result).toBe(false);
        });
    });

    describe('getFinancialStats()', () => {
        it('should return financial statistics for organization', async () => {
            const organizationId = 'org-123';
            const mockStats = {
                total_capex: 50000,
                total_opex: 25000,
                avg_roi: 15.5
            };

            vi.mocked(mockDb.get).mockImplementationOnce(() => Promise.resolve(mockStats));

            const result = await financialService.getFinancialStats(organizationId);

            expect(result.totalCapex).toBe(50000);
            expect(result.totalOpex).toBe(25000);
            expect(result.avgRoi).toBe(15.5);
            expect(mockDb.get).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                [organizationId]
            );
        });

        it('should return zeros when no initiatives exist', async () => {
            const organizationId = 'org-empty';
            vi.mocked(mockDb.get).mockImplementationOnce(() => Promise.resolve(null));

            const result = await financialService.getFinancialStats(organizationId);

            expect(result.totalCapex).toBe(0);
            expect(result.totalOpex).toBe(0);
            expect(result.avgRoi).toBe(0);
        });

        it('should handle database errors', async () => {
            const organizationId = 'org-error';
            const dbError = new Error('Database error');
            vi.mocked(mockDb.get).mockImplementationOnce(() => Promise.reject(dbError));

            await expect(financialService.getFinancialStats(organizationId)).rejects.toThrow();
        });
    });
});
