/**
 * Unit Tests for ReportCommentsService
 * 
 * Tests the inline commenting system for Management Reports.
 */

const ReportCommentsService = require('../services/reportCommentsService');

// Mock database
jest.mock('../database', () => {
    const mockDb = {
        get: jest.fn(),
        all: jest.fn(),
        run: jest.fn()
    };
    return mockDb;
});

// Mock notification service
jest.mock('../services/notificationOutboxService', () => ({
    send: jest.fn().mockResolvedValue({ id: 'notif1' })
}));

const db = require('../database');
const NotificationOutboxService = require('../services/notificationOutboxService');

describe('ReportCommentsService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('addComment', () => {
        it('should add a new comment to a report', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('FROM management_reports')) {
                    callback(null, { id: 'report1', organization_id: 'org1' });
                } else if (sql.includes('FROM management_report_versions')) {
                    callback(null, { id: 'version1' });
                }
            });

            db.run.mockImplementation((sql, params, callback) => {
                callback.call({ lastID: 1, changes: 1 }, null);
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
            db.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('FROM management_reports')) {
                    callback(null, { id: 'report1', organization_id: 'org1' });
                } else if (sql.includes('FROM management_report_comments WHERE id')) {
                    callback(null, { 
                        id: 'comment1', 
                        report_id: 'report1',
                        created_by: 'user2' 
                    });
                }
            });

            db.run.mockImplementation((sql, params, callback) => {
                callback.call({ lastID: 2 }, null);
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
            db.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('FROM management_reports')) {
                    callback(null, { id: 'report1', organization_id: 'org1', title: 'Q4 Report' });
                } else if (sql.includes('FROM users WHERE id')) {
                    callback(null, { id: 'user2', email: 'user2@test.com' });
                }
            });

            db.run.mockImplementation((sql, params, callback) => {
                callback.call({ lastID: 1 }, null);
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
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, { id: 'report1', status: 'FINAL', locked_at: new Date() });
            });

            await expect(
                ReportCommentsService.addComment('report1', null, 'Comment', 'user1', [], null)
            ).rejects.toThrow('Cannot add comments to a finalized report');
        });
    });

    describe('getComments', () => {
        it('should return all comments for a report', async () => {
            db.all.mockImplementation((sql, params, callback) => {
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
            });

            const result = await ReportCommentsService.getComments('report1');

            expect(result.length).toBe(2);
            expect(result[0].isResolved).toBe(false);
            expect(result[1].isResolved).toBe(true);
        });

        it('should filter by section', async () => {
            db.all.mockImplementation((sql, params, callback) => {
                const filtered = params.includes('executiveSummary');
                callback(null, filtered 
                    ? [{ id: 'c1', section_id: 'executiveSummary' }]
                    : []
                );
            });

            const result = await ReportCommentsService.getComments('report1', 'executiveSummary');

            expect(result.length).toBe(1);
            expect(result[0].section_id).toBe('executiveSummary');
        });

        it('should filter by resolved status', async () => {
            db.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    { id: 'c1', is_resolved: 0 }
                ]);
            });

            const result = await ReportCommentsService.getComments('report1', null, false);

            expect(result.every(c => c.is_resolved === 0)).toBe(true);
        });
    });

    describe('getComment', () => {
        it('should return a specific comment', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'comment1',
                    report_id: 'report1',
                    content: 'Test comment',
                    created_by: 'user1'
                });
            });

            const result = await ReportCommentsService.getComment('comment1');

            expect(result.id).toBe('comment1');
            expect(result.content).toBe('Test comment');
        });

        it('should return null for non-existent comment', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, null);
            });

            const result = await ReportCommentsService.getComment('nonexistent');

            expect(result).toBeNull();
        });
    });

    describe('updateComment', () => {
        it('should update comment content', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'comment1',
                    report_id: 'report1',
                    content: 'Old content',
                    created_by: 'user1',
                    is_resolved: 0
                });
            });

            db.run.mockImplementation((sql, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await ReportCommentsService.updateComment(
                'comment1',
                'user1',
                'Updated content',
                null
            );

            expect(result.content).toBe('Updated content');
        });

        it('should throw error if user is not the author', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'comment1',
                    created_by: 'user2' // Different user
                });
            });

            await expect(
                ReportCommentsService.updateComment('comment1', 'user1', 'Updated', null)
            ).rejects.toThrow('Only the author can edit this comment');
        });
    });

    describe('resolveComment', () => {
        it('should mark comment as resolved', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'comment1',
                    report_id: 'report1',
                    is_resolved: 0
                });
            });

            db.run.mockImplementation((sql, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await ReportCommentsService.resolveComment('comment1', 'user1');

            expect(result.isResolved).toBe(true);
            expect(result.resolvedBy).toBe('user1');
        });

        it('should also resolve all replies', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'comment1',
                    report_id: 'report1',
                    is_resolved: 0
                });
            });

            db.run.mockImplementation((sql, params, callback) => {
                callback.call({ changes: 3 }, null); // Parent + 2 replies
            });

            await ReportCommentsService.resolveComment('comment1', 'user1');

            // Check that UPDATE was called for both parent and children
            const updateCalls = db.run.mock.calls.filter(c => c[0].includes('UPDATE'));
            expect(updateCalls.length).toBeGreaterThan(0);
        });
    });

    describe('unresolveComment', () => {
        it('should mark comment as unresolved', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'comment1',
                    report_id: 'report1',
                    is_resolved: 1,
                    resolved_by: 'user2'
                });
            });

            db.run.mockImplementation((sql, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await ReportCommentsService.unresolveComment('comment1', 'user1');

            expect(result.isResolved).toBe(false);
            expect(result.resolvedBy).toBeNull();
        });
    });

    describe('deleteComment', () => {
        it('should delete comment and its replies', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'comment1',
                    report_id: 'report1',
                    created_by: 'user1'
                });
            });

            db.run.mockImplementation((sql, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await ReportCommentsService.deleteComment('comment1', 'user1');

            expect(result.deleted).toBe(true);
        });

        it('should throw error if user is not the author', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'comment1',
                    created_by: 'user2'
                });
            });

            await expect(
                ReportCommentsService.deleteComment('comment1', 'user1')
            ).rejects.toThrow('Only the author can delete this comment');
        });

        it('should allow admin to delete any comment', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('FROM management_report_comments')) {
                    callback(null, {
                        id: 'comment1',
                        created_by: 'user2'
                    });
                } else if (sql.includes('FROM users')) {
                    callback(null, { id: 'admin1', role: 'ADMIN' });
                }
            });

            db.run.mockImplementation((sql, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await ReportCommentsService.deleteComment('comment1', 'admin1', true);

            expect(result.deleted).toBe(true);
        });
    });

    describe('getThreadedComments', () => {
        it('should return comments organized as threads', async () => {
            db.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    { id: 'c1', parent_comment_id: null, content: 'Parent 1' },
                    { id: 'c2', parent_comment_id: 'c1', content: 'Reply to 1' },
                    { id: 'c3', parent_comment_id: null, content: 'Parent 2' },
                    { id: 'c4', parent_comment_id: 'c1', content: 'Another reply to 1' }
                ]);
            });

            const result = await ReportCommentsService.getThreadedComments('report1');

            expect(result.length).toBe(2); // 2 parent comments
            expect(result[0].replies.length).toBe(2);
            expect(result[1].replies.length).toBe(0);
        });
    });

    describe('getCommentCount', () => {
        it('should return comment counts by status', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('COUNT') && sql.includes('is_resolved = 0')) {
                    callback(null, { count: 5 });
                } else if (sql.includes('COUNT') && sql.includes('is_resolved = 1')) {
                    callback(null, { count: 3 });
                } else {
                    callback(null, { count: 8 });
                }
            });

            const result = await ReportCommentsService.getCommentCount('report1');

            expect(result.total).toBe(8);
            expect(result.open).toBe(5);
            expect(result.resolved).toBe(3);
        });
    });

    describe('getCommentsBySection', () => {
        it('should return comments grouped by section', async () => {
            db.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    { section_id: 'executiveSummary', count: 3 },
                    { section_id: 'kpis', count: 5 },
                    { section_id: 'risksAndIssues', count: 2 }
                ]);
            });

            const result = await ReportCommentsService.getCommentsBySection('report1');

            expect(result.executiveSummary).toBe(3);
            expect(result.kpis).toBe(5);
            expect(result.risksAndIssues).toBe(2);
        });
    });
});


