/**
 * Content Service Tests
 * Tests for categories, tags, comments, reviews, favorites, and analytics
 */

const { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } = require('vitest');

// Mock the database
vi.mock('../../../server/database', () => {
    const mockDb = {
        run: vi.fn(),
        get: vi.fn(),
        all: vi.fn(),
        serialize: vi.fn((fn) => fn())
    };
    return { default: mockDb };
});

const db = require('../../../server/database').default;
const ContentService = require('../../../server/services/contentService');

describe('ContentService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Categories', () => {
        describe('createCategory', () => {
            it('should create a category with all fields', async () => {
                db.run.mockImplementation((query, params, callback) => {
                    callback.call({ lastID: 1, changes: 1 }, null);
                });

                const result = await ContentService.createCategory({
                    name: 'Test Category',
                    slug: 'test-category',
                    description: 'A test category',
                    contentType: 'PLAYBOOK',
                    parentId: null,
                    sortOrder: 1,
                    color: '#6366F1',
                    icon: 'folder',
                    organizationId: 'org-123',
                    createdBy: 'user-123'
                });

                expect(result).toBeDefined();
                expect(result.name).toBe('Test Category');
                expect(result.slug).toBe('test-category');
                expect(result.contentType).toBe('PLAYBOOK');
                expect(result.isActive).toBe(true);
                expect(result.id).toMatch(/^cat-/);
                expect(db.run).toHaveBeenCalled();
            });

            it('should generate slug from name if not provided', async () => {
                db.run.mockImplementation((query, params, callback) => {
                    callback.call({ lastID: 1, changes: 1 }, null);
                });

                const result = await ContentService.createCategory({
                    name: 'My Test Category'
                });

                expect(result.slug).toBe('my-test-category');
            });

            it('should throw error if name is missing', async () => {
                await expect(ContentService.createCategory({})).rejects.toThrow('name is required');
            });

            it('should handle unique constraint violation', async () => {
                db.run.mockImplementation((query, params, callback) => {
                    callback(new Error('UNIQUE constraint failed'));
                });

                await expect(ContentService.createCategory({ name: 'Duplicate' }))
                    .rejects.toThrow(/already exists/);
            });
        });

        describe('getCategoryById', () => {
            it('should return category when found', async () => {
                const mockRow = {
                    id: 'cat-123',
                    name: 'Test Category',
                    slug: 'test-category',
                    description: 'Test',
                    content_type: 'ALL',
                    parent_id: null,
                    sort_order: 0,
                    color: '#6366F1',
                    icon: 'folder',
                    organization_id: 'org-123',
                    is_active: 1,
                    created_at: '2024-01-01T00:00:00Z',
                    updated_at: '2024-01-01T00:00:00Z',
                    created_by: 'user-123'
                };

                db.get.mockImplementation((query, params, callback) => {
                    callback(null, mockRow);
                });

                const result = await ContentService.getCategoryById('cat-123');

                expect(result).toBeDefined();
                expect(result.id).toBe('cat-123');
                expect(result.name).toBe('Test Category');
                expect(result.isActive).toBe(true);
            });

            it('should return null when category not found', async () => {
                db.get.mockImplementation((query, params, callback) => {
                    callback(null, null);
                });

                const result = await ContentService.getCategoryById('non-existent');
                expect(result).toBeNull();
            });
        });

        describe('listCategories', () => {
            it('should return list of categories', async () => {
                const mockRows = [
                    {
                        id: 'cat-1',
                        name: 'Category 1',
                        slug: 'category-1',
                        content_type: 'ALL',
                        is_active: 1
                    },
                    {
                        id: 'cat-2',
                        name: 'Category 2',
                        slug: 'category-2',
                        content_type: 'PLAYBOOK',
                        is_active: 1
                    }
                ];

                db.all.mockImplementation((query, params, callback) => {
                    callback(null, mockRows);
                });

                const result = await ContentService.listCategories();

                expect(result).toHaveLength(2);
                expect(result[0].name).toBe('Category 1');
                expect(result[1].name).toBe('Category 2');
            });

            it('should filter by contentType', async () => {
                db.all.mockImplementation((query, params, callback) => {
                    expect(query).toContain('content_type');
                    expect(params).toContain('PLAYBOOK');
                    callback(null, []);
                });

                await ContentService.listCategories({ contentType: 'PLAYBOOK' });
            });

            it('should filter by organizationId', async () => {
                db.all.mockImplementation((query, params, callback) => {
                    expect(query).toContain('organization_id');
                    expect(params).toContain('org-123');
                    callback(null, []);
                });

                await ContentService.listCategories({ organizationId: 'org-123' });
            });
        });

        describe('updateCategory', () => {
            it('should update category fields', async () => {
                db.run.mockImplementation((query, params, callback) => {
                    callback.call({ changes: 1 }, null);
                });
                db.get.mockImplementation((query, params, callback) => {
                    callback(null, { id: 'cat-123', name: 'Updated', is_active: 1 });
                });

                const result = await ContentService.updateCategory('cat-123', {
                    name: 'Updated',
                    color: '#FF0000'
                });

                expect(db.run).toHaveBeenCalled();
                expect(result).toBeDefined();
            });
        });

        describe('deleteCategory', () => {
            it('should delete category', async () => {
                db.run.mockImplementation((query, params, callback) => {
                    callback.call({ changes: 1 }, null);
                });

                const result = await ContentService.deleteCategory('cat-123');
                expect(result).toBe(true);
            });

            it('should return false if category not found', async () => {
                db.run.mockImplementation((query, params, callback) => {
                    callback.call({ changes: 0 }, null);
                });

                const result = await ContentService.deleteCategory('non-existent');
                expect(result).toBe(false);
            });
        });
    });

    describe('Tags', () => {
        describe('createTag', () => {
            it('should create a tag', async () => {
                db.run.mockImplementation((query, params, callback) => {
                    callback.call({ lastID: 1, changes: 1 }, null);
                });

                const result = await ContentService.createTag({
                    name: 'Test Tag',
                    color: '#10B981',
                    contentType: 'ALL'
                });

                expect(result).toBeDefined();
                expect(result.name).toBe('Test Tag');
                expect(result.color).toBe('#10B981');
                expect(result.usageCount).toBe(0);
                expect(result.id).toMatch(/^tag-/);
            });

            it('should throw error if name is missing', async () => {
                await expect(ContentService.createTag({})).rejects.toThrow('name is required');
            });
        });

        describe('listTags', () => {
            it('should return list of tags', async () => {
                const mockRows = [
                    { id: 'tag-1', name: 'Tag 1', slug: 'tag-1', color: '#FF0000', usage_count: 5, is_active: 1 },
                    { id: 'tag-2', name: 'Tag 2', slug: 'tag-2', color: '#00FF00', usage_count: 3, is_active: 1 }
                ];

                db.all.mockImplementation((query, params, callback) => {
                    callback(null, mockRows);
                });

                const result = await ContentService.listTags();

                expect(result).toHaveLength(2);
                expect(result[0].usageCount).toBe(5);
            });

            it('should support search', async () => {
                db.all.mockImplementation((query, params, callback) => {
                    expect(query).toContain('LIKE');
                    callback(null, []);
                });

                await ContentService.listTags({ search: 'test' });
            });
        });

        describe('addTagToContent', () => {
            it('should add tag to content and update usage count', async () => {
                let runCount = 0;
                db.run.mockImplementation((query, params, callback) => {
                    runCount++;
                    if (runCount === 1) {
                        callback.call({ changes: 1 }, null);
                    } else {
                        callback(null);
                    }
                });

                const result = await ContentService.addTagToContent(
                    'content-123',
                    'PLAYBOOK_TEMPLATE',
                    'tag-123',
                    'user-123'
                );

                expect(result).toBe(true);
                expect(db.run).toHaveBeenCalledTimes(2);
            });
        });

        describe('removeTagFromContent', () => {
            it('should remove tag and decrement usage count', async () => {
                let runCount = 0;
                db.run.mockImplementation((query, params, callback) => {
                    runCount++;
                    if (runCount === 1) {
                        callback.call({ changes: 1 }, null);
                    } else {
                        callback(null);
                    }
                });

                const result = await ContentService.removeTagFromContent(
                    'content-123',
                    'PLAYBOOK_TEMPLATE',
                    'tag-123'
                );

                expect(result).toBe(true);
            });
        });
    });

    describe('Comments', () => {
        describe('createComment', () => {
            it('should create a comment', async () => {
                db.run.mockImplementation((query, params, callback) => {
                    callback.call({ lastID: 1, changes: 1 }, null);
                });

                const result = await ContentService.createComment({
                    contentId: 'playbook-123',
                    contentType: 'PLAYBOOK_TEMPLATE',
                    userId: 'user-123',
                    commentText: 'This is a test comment'
                });

                expect(result).toBeDefined();
                expect(result.commentText).toBe('This is a test comment');
                expect(result.isResolved).toBe(false);
                expect(result.id).toMatch(/^cmt-/);
            });

            it('should throw error if required fields missing', async () => {
                await expect(ContentService.createComment({}))
                    .rejects.toThrow(/required/);
            });

            it('should handle parent comment for threading', async () => {
                db.get.mockImplementation((query, params, callback) => {
                    callback(null, { thread_id: 'thread-parent' });
                });
                db.run.mockImplementation((query, params, callback) => {
                    callback.call({ lastID: 1 }, null);
                });

                const result = await ContentService.createComment({
                    contentId: 'playbook-123',
                    contentType: 'PLAYBOOK_TEMPLATE',
                    userId: 'user-123',
                    commentText: 'Reply comment',
                    parentCommentId: 'cmt-parent'
                });

                expect(result.parentCommentId).toBe('cmt-parent');
            });
        });

        describe('getContentComments', () => {
            it('should return threaded comments', async () => {
                const mockRows = [
                    {
                        id: 'cmt-1',
                        content_id: 'playbook-123',
                        content_type: 'PLAYBOOK_TEMPLATE',
                        user_id: 'user-1',
                        comment_text: 'Root comment',
                        parent_comment_id: null,
                        thread_id: 'cmt-1',
                        is_resolved: 0,
                        is_edited: 0,
                        first_name: 'John',
                        last_name: 'Doe'
                    },
                    {
                        id: 'cmt-2',
                        content_id: 'playbook-123',
                        content_type: 'PLAYBOOK_TEMPLATE',
                        user_id: 'user-2',
                        comment_text: 'Reply',
                        parent_comment_id: 'cmt-1',
                        thread_id: 'cmt-1',
                        is_resolved: 0,
                        is_edited: 0,
                        first_name: 'Jane',
                        last_name: 'Smith'
                    }
                ];

                db.all.mockImplementation((query, params, callback) => {
                    callback(null, mockRows);
                });

                const result = await ContentService.getContentComments('playbook-123', 'PLAYBOOK_TEMPLATE');

                expect(result).toHaveLength(1); // Only root comments at top level
                expect(result[0].replies).toHaveLength(1); // Reply nested
            });
        });

        describe('resolveComment', () => {
            it('should resolve comment', async () => {
                db.run.mockImplementation((query, params, callback) => {
                    callback.call({ changes: 1 }, null);
                });
                db.get.mockImplementation((query, params, callback) => {
                    callback(null, {
                        id: 'cmt-123',
                        is_resolved: 1,
                        resolved_by: 'user-456',
                        resolved_at: '2024-01-01T00:00:00Z'
                    });
                });

                const result = await ContentService.resolveComment('cmt-123', 'user-456');

                expect(result.isResolved).toBe(true);
                expect(result.resolvedBy).toBe('user-456');
            });
        });
    });

    describe('Reviews', () => {
        describe('createReview', () => {
            it('should create a review request', async () => {
                db.run.mockImplementation((query, params, callback) => {
                    callback.call({ lastID: 1, changes: 1 }, null);
                });

                const result = await ContentService.createReview({
                    contentId: 'playbook-123',
                    contentType: 'PLAYBOOK_TEMPLATE',
                    requestedBy: 'user-123',
                    reviewerId: 'user-456',
                    priority: 'HIGH',
                    dueDate: '2024-12-31'
                });

                expect(result).toBeDefined();
                expect(result.status).toBe('PENDING');
                expect(result.priority).toBe('HIGH');
                expect(result.id).toMatch(/^rev-/);
            });

            it('should throw error if required fields missing', async () => {
                await expect(ContentService.createReview({}))
                    .rejects.toThrow(/required/);
            });
        });

        describe('updateReviewStatus', () => {
            it('should update review status to APPROVED', async () => {
                db.run.mockImplementation((query, params, callback) => {
                    callback.call({ changes: 1 }, null);
                });
                db.get.mockImplementation((query, params, callback) => {
                    callback(null, {
                        id: 'rev-123',
                        status: 'APPROVED',
                        reviewed_at: '2024-01-01T00:00:00Z'
                    });
                });

                const result = await ContentService.updateReviewStatus(
                    'rev-123',
                    'APPROVED',
                    'Looks good!'
                );

                expect(result.status).toBe('APPROVED');
            });
        });

        describe('getPendingReviews', () => {
            it('should return pending reviews ordered by priority', async () => {
                const mockRows = [
                    { id: 'rev-1', status: 'PENDING', priority: 'URGENT' },
                    { id: 'rev-2', status: 'IN_REVIEW', priority: 'HIGH' }
                ];

                db.all.mockImplementation((query, params, callback) => {
                    expect(query).toContain('PENDING');
                    expect(query).toContain('IN_REVIEW');
                    expect(query).toContain('priority');
                    callback(null, mockRows);
                });

                const result = await ContentService.getPendingReviews('user-123');

                expect(result).toHaveLength(2);
            });
        });
    });

    describe('Favorites', () => {
        describe('addFavorite', () => {
            it('should add content to favorites', async () => {
                db.run.mockImplementation((query, params, callback) => {
                    callback.call({ changes: 1 }, null);
                });

                const result = await ContentService.addFavorite(
                    'user-123',
                    'playbook-456',
                    'PLAYBOOK_TEMPLATE',
                    { notes: 'Great playbook!', folderName: 'Work' }
                );

                expect(result).toBeDefined();
                expect(result.contentId).toBe('playbook-456');
                expect(result.notes).toBe('Great playbook!');
                expect(result.folderName).toBe('Work');
            });
        });

        describe('removeFavorite', () => {
            it('should remove from favorites', async () => {
                db.run.mockImplementation((query, params, callback) => {
                    callback.call({ changes: 1 }, null);
                });

                const result = await ContentService.removeFavorite(
                    'user-123',
                    'playbook-456',
                    'PLAYBOOK_TEMPLATE'
                );

                expect(result).toBe(true);
            });
        });

        describe('getUserFavorites', () => {
            it('should return user favorites', async () => {
                const mockRows = [
                    {
                        id: 'fav-1',
                        user_id: 'user-123',
                        content_id: 'playbook-1',
                        content_type: 'PLAYBOOK_TEMPLATE',
                        folder_name: 'Default',
                        created_at: '2024-01-01T00:00:00Z'
                    }
                ];

                db.all.mockImplementation((query, params, callback) => {
                    callback(null, mockRows);
                });

                const result = await ContentService.getUserFavorites('user-123');

                expect(result).toHaveLength(1);
                expect(result[0].contentId).toBe('playbook-1');
            });

            it('should filter by content type', async () => {
                db.all.mockImplementation((query, params, callback) => {
                    expect(query).toContain('content_type');
                    expect(params).toContain('PLAYBOOK_TEMPLATE');
                    callback(null, []);
                });

                await ContentService.getUserFavorites('user-123', { contentType: 'PLAYBOOK_TEMPLATE' });
            });
        });

        describe('isFavorited', () => {
            it('should return true if favorited', async () => {
                db.get.mockImplementation((query, params, callback) => {
                    callback(null, { 1: 1 });
                });

                const result = await ContentService.isFavorited(
                    'user-123',
                    'playbook-456',
                    'PLAYBOOK_TEMPLATE'
                );

                expect(result).toBe(true);
            });

            it('should return false if not favorited', async () => {
                db.get.mockImplementation((query, params, callback) => {
                    callback(null, null);
                });

                const result = await ContentService.isFavorited(
                    'user-123',
                    'playbook-456',
                    'PLAYBOOK_TEMPLATE'
                );

                expect(result).toBe(false);
            });
        });
    });

    describe('Analytics', () => {
        describe('logAnalyticsEvent', () => {
            it('should log analytics event', async () => {
                db.run.mockImplementation((query, params, callback) => {
                    callback.call({ lastID: 1 }, null);
                });

                const result = await ContentService.logAnalyticsEvent({
                    contentId: 'playbook-123',
                    contentType: 'PLAYBOOK_TEMPLATE',
                    eventType: 'VIEW',
                    userId: 'user-123',
                    organizationId: 'org-123',
                    metadata: { source: 'search' }
                });

                expect(result).toBeDefined();
                expect(result.eventType).toBe('VIEW');
                expect(result.id).toMatch(/^ca-/);
            });
        });

        describe('getContentAnalytics', () => {
            it('should return content analytics', async () => {
                db.get.mockImplementation((query, params, callback) => {
                    callback(null, {
                        total_events: 100,
                        unique_users: 25,
                        unique_orgs: 5,
                        views: 80,
                        edits: 10,
                        uses: 5,
                        exports: 3,
                        clones: 2,
                        first_interaction: '2024-01-01T00:00:00Z',
                        last_interaction: '2024-01-15T00:00:00Z'
                    });
                });

                const result = await ContentService.getContentAnalytics(
                    'playbook-123',
                    'PLAYBOOK_TEMPLATE'
                );

                expect(result.totalEvents).toBe(100);
                expect(result.uniqueUsers).toBe(25);
                expect(result.views).toBe(80);
            });
        });

        describe('getAnalyticsDashboard', () => {
            it('should return dashboard data', async () => {
                // Mock multiple db.get calls
                db.get.mockImplementation((query, params, callback) => {
                    if (query.includes('ai_playbook_templates')) {
                        callback(null, {
                            published_playbooks: 10,
                            total_playbooks: 15,
                            published_emails: 5,
                            total_emails: 8,
                            total_categories: 3,
                            total_tags: 12
                        });
                    } else if (query.includes('ai_playbook_runs')) {
                        callback(null, {
                            total_runs: 100,
                            completed_runs: 85,
                            failed_runs: 10
                        });
                    } else if (query.includes('email_sends')) {
                        callback(null, {
                            total_sends: 500,
                            opened: 200,
                            clicked: 50
                        });
                    } else {
                        callback(null, {});
                    }
                });

                const result = await ContentService.getAnalyticsDashboard();

                expect(result).toBeDefined();
                expect(result.totalPlaybookTemplates).toBeDefined();
                expect(result.avgPlaybookSuccessRate).toBeDefined();
            });
        });
    });

    describe('Global Search', () => {
        describe('searchContent', () => {
            it('should search across playbooks and emails', async () => {
                db.all.mockImplementation((query, params, callback) => {
                    if (query.includes('ai_playbook_templates')) {
                        callback(null, [
                            {
                                id: 'pb-1',
                                key: 'playbook-1',
                                title: 'Test Playbook',
                                status: 'PUBLISHED',
                                created_at: '2024-01-01'
                            }
                        ]);
                    } else if (query.includes('email_templates')) {
                        callback(null, [
                            {
                                id: 'em-1',
                                template_key: 'email-1',
                                name: 'Test Email',
                                status: 'PUBLISHED',
                                created_at: '2024-01-02'
                            }
                        ]);
                    } else {
                        callback(null, []);
                    }
                });

                const result = await ContentService.searchContent({
                    query: 'test',
                    contentTypes: ['PLAYBOOK_TEMPLATE', 'EMAIL_TEMPLATE']
                });

                expect(result.items).toHaveLength(2);
                expect(result.total).toBe(2);
            });

            it('should filter by status', async () => {
                db.all.mockImplementation((query, params, callback) => {
                    expect(query).toContain('status');
                    callback(null, []);
                });

                await ContentService.searchContent({
                    query: 'test',
                    statuses: ['PUBLISHED']
                });
            });

            it('should paginate results', async () => {
                const mockPlaybooks = Array.from({ length: 30 }, (_, i) => ({
                    id: `pb-${i}`,
                    title: `Playbook ${i}`,
                    status: 'PUBLISHED'
                }));

                db.all.mockImplementation((query, params, callback) => {
                    if (query.includes('ai_playbook_templates')) {
                        callback(null, mockPlaybooks);
                    } else {
                        callback(null, []);
                    }
                });

                const result = await ContentService.searchContent({
                    query: '',
                    page: 2,
                    limit: 10
                });

                expect(result.items).toHaveLength(10);
                expect(result.page).toBe(2);
                expect(result.hasMore).toBe(true);
            });
        });
    });

    describe('Helper Functions', () => {
        it('should convert camelCase to snake_case', () => {
            expect(ContentService._camelToSnake('contentType')).toBe('content_type');
            expect(ContentService._camelToSnake('isActive')).toBe('is_active');
            expect(ContentService._camelToSnake('parentId')).toBe('parent_id');
        });
    });
});




