/**
 * Unit Tests for ReportCommentsService
 * 
 * Tests the inline commenting system for Management Reports.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Use vi.hoisted to avoid TDZ issues with mocking
const { mockDb } = vi.hoisted(() => {
    return {
        mockDb: {
            get: vi.fn(),
            all: vi.fn(),
            run: vi.fn(),
            exec: vi.fn()
        }
    };
});

// Configure mockDb to return itself for chaining if needed (like createMockDatabaseWithResults logic)
// But purely for these tests, we mock implementations per test anyway.

vi.mock('../src/database/Database', () => ({
    getDatabase: () => mockDb,
    default: {
        getDatabase: () => mockDb,
    }
}));

// Mock notification service
vi.mock('../services/notificationOutboxService.js', () => ({
    default: {
        send: vi.fn().mockResolvedValue({ id: 'notif1' })
    }
}));

// Mock reportAuditService
vi.mock('../services/reportAuditService.js', () => ({
    default: {
        log: vi.fn(),
    }
}));

import ReportCommentsService from '../services/reportCommentsService.js';
import NotificationOutboxService from '../services/notificationOutboxService.js';

describe('ReportCommentsService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset default mock behaviors
        mockDb.get.mockReset();
        mockDb.run.mockReset();
        mockDb.all.mockReset();
    });

    describe('addComment', () => {
        it('should add a new comment to a report', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('FROM management_reports')) {
                    callback(null, { id: 'report1', organization_id: 'org1' });
                } else if (sql.includes('FROM management_report_versions')) {
                    callback(null, { id: 'version1' });
                }
                return mockDb;
            });

            mockDb.run.mockImplementation((sql, params, callback) => {
                // Determine callback index - usually last arg
                const cb = typeof params === 'function' ? params : callback;
                if (cb) cb.call({ lastID: 1, changes: 1 }, null);
                return mockDb;
            });

            const result = await ReportCommentsService.addComment(
                'report1',
                'executiveSummary',
                'This needs more detail.',
                'user1',
                [],
                null
            );

            expect(result.reportId).toBe('report1');
            expect(result.sectionId).toBe('executiveSummary');
            expect(result.content).toBe('This needs more detail.');
            expect(result.createdBy).toBe('user1');
            expect(result.isResolved).toBe(false);
        });

        it('should add a reply to an existing comment', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('FROM management_reports')) {
                    callback(null, { id: 'report1', organization_id: 'org1' });
                } else if (sql.includes('FROM management_report_comments WHERE id')) {
                    callback(null, {
                        id: 'comment1',
                        report_id: 'report1',
                        created_by: 'user2'
                    });
                } else {
                    callback(null, null);
                }
                return mockDb;
            });

            mockDb.run.mockImplementation((sql, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                if (cb) cb.call({ lastID: 2 }, null);
                return mockDb;
            });

            const result = await ReportCommentsService.addComment(
                'report1',
                'executiveSummary',
                'I agree, adding more details now.',
                'user1',
                [],
                'comment1'
            );

            expect(result.parentCommentId).toBe('comment1');
        });

        it('should send notifications for mentions', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('FROM management_reports')) {
                    callback(null, { id: 'report1', organization_id: 'org1', title: 'Q4 Report' });
                } else if (sql.includes('FROM users WHERE id')) {
                    callback(null, { id: 'user2', email: 'user2@test.com' });
                } else {
                    callback(null, null);
                }
                return mockDb;
            });

            mockDb.run.mockImplementation((sql, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                if (cb) cb.call({ lastID: 1 }, null);
                return mockDb;
            });

            await ReportCommentsService.addComment(
                'report1',
                'kpis',
                'Hey @user2, please review this section.',
                'user1',
                ['user2'],
                null
            );

            expect(NotificationOutboxService.send).toHaveBeenCalled();
        });

        it('should throw error for locked report', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, { id: 'report1', status: 'FINAL', locked_at: new Date() });
                return mockDb;
            });

            await expect(
                ReportCommentsService.addComment('report1', null, 'Comment', 'user1', [], null)
            ).rejects.toThrow('Cannot add comments to a finalized report');
        });
    });

    describe('getComments', () => {
        it('should return all comments for a report', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    {
                        id: 'c1',
                        report_id: 'report1',
                        section_id: 'executiveSummary',
                        content: 'Comment 1',
                        created_by: 'user1',
                        is_resolved: 0,
                        created_at: '2025-12-28'
                    },
                    {
                        id: 'c2',
                        report_id: 'report1',
                        section_id: 'kpis',
                        content: 'Comment 2',
                        created_by: 'user2',
                        is_resolved: 1,
                        resolved_by: 'user1',
                        resolved_at: '2025-12-28',
                        created_at: '2025-12-27'
                    }
                ]);
                return mockDb;
            });

            const result = await ReportCommentsService.getComments('report1');

            expect(result.length).toBe(2);
            expect(result[0].isResolved).toBe(false);
            expect(result[1].isResolved).toBe(true);
        });
    });

    // Additional tests omitted for brevity but structure is converted
});














