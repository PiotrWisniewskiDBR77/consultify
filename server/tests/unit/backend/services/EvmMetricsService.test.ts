/**
 * EVMMetricsService Unit Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

// Use vi.hoisted to ensure mock data is available to vi.mock
const { mockDb } = vi.hoisted(() => ({
    mockDb: {
        get: vi.fn(),
        all: vi.fn(),
        run: vi.fn().mockResolvedValue({ lastID: 1, changes: 1 }),
        exec: vi.fn(),
        serialize: vi.fn(),
        close: vi.fn(),
        query: vi.fn(),
    },
}));

// Mock the Database module
vi.mock('../../../../src/database/Database.ts', () => ({
    getDatabase: () => mockDb,
    default: mockDb,
}));

import EVMMetricsService from '../../../../src/services/evmMetricsService.js';

describe('EVMMetricsService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('calculateEVM', () => {
        it('should calculate all EVM metrics correctly', async () => {
            // Mock project data
            (mockDb.get as Mock).mockImplementation(
                (sql: string, params: any[], callback: (err: Error | null, row: any) => void) => {
                    if (sql.includes('FROM project_budgets')) {
                        callback(null, {
                            bac: 100000,
                            ac: 48000,
                        });
                    } else if (sql.includes('FROM projects')) {
                        callback(null, {
                            id: 'project1',
                            start_date: '2025-01-01',
                            target_end_date: '2025-12-31',
                        });
                    } else if (sql.includes('COUNT(*)') && sql.includes('tasks')) {
                        callback(null, {
                            total_tasks: 10,
                            completed_tasks: 5,
                        });
                    } else {
                        callback(null, null);
                    }
                },
            );

            (mockDb.all as Mock).mockImplementation(
                (sql: string, params: any[], callback: (err: Error | null, rows: any[]) => void) => {
                    callback(null, []);
                },
            );

            const result = await EVMMetricsService.calculateEVM('project1');

            expect(result).toBeDefined();
            expect(result.bac).toBe(100000);
            expect(result.ac).toBe(48000);
            expect(result.percentComplete).toBe(50);
            expect(result.ev).toBe(50000);
            expect(result.cv).toBe(2000);
        });

        it('should handle project not found', async () => {
            (mockDb.get as Mock).mockImplementation(
                (sql: string, params: any[], callback: (err: Error | null, row: any) => void) => {
                    callback(null, null);
                },
            );

            const result = await EVMMetricsService.calculateEVM('nonexistent');
            expect(result.bac).toBe(100000);
            expect(result.ac).toBe(0);
        });
    });

    describe('getEVMForReport', () => {
        it('should return formatted EVM data for report', async () => {
            (mockDb.get as Mock).mockImplementation(
                (sql: string, params: any[], callback: (err: Error | null, row: any) => void) => {
                    callback(null, { bac: 100000 });
                },
            );

            const result = await EVMMetricsService.getEVMForReport('project1', '2025-06-30');

            expect(result).toBeDefined();
            expect(result.periodEnd).toBe('2025-06-30');
        });
    });
});
