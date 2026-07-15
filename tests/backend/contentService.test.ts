/**
 * Content Service Tests
 * Tests for categories, tags, comments, reviews, favorites, and analytics
 *
 * Reviving note (2026-07-15): original file (tests/server/services/contentService.test)
 * used CommonJS require() + a raw sqlite3-callback-style `server/database` mock
 * against `ContentService.method()` static-style calls. Today's
 * server/src/services/contentService.ts is a class (`ContentService`) that is
 * constructed with `{ db, uuidv4 }` deps (Promise-style IDatabase, not
 * callback-style), delegating to per-domain sub-services
 * (CategoryService/TagService/CommentService/ReviewService/
 * ContentAnalyticsService/FavoriteService/ContentSearchService). Converted to
 * instantiate the class directly with a mock db instead of mocking a
 * `server/database` module that nothing here imports anymore.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContentService } from '../../server/src/services/contentService.js';

describe('ContentService', () => {
    let db;
    let contentService;

    beforeEach(() => {
        db = {
            run: vi.fn(),
            get: vi.fn(),
            all: vi.fn()
        };
        contentService = new ContentService({ db, uuidv4: () => 'test-uuid' });
    });

    describe('Categories', () => {
        describe('createCategory', () => {
            it('should create a category with all fields', async () => {
                db.run.mockResolvedValue({ lastID: 1, changes: 1 });

                const result = await contentService.createCategory({
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
                db.run.mockResolvedValue({ lastID: 1, changes: 1 });

                const result = await contentService.createCategory({
                    name: 'My Test Category'
                });

                expect(result.slug).toBe('my-test-category');
            });

            it('should throw error if name is missing', async () => {
                await expect(contentService.createCategory({})).rejects.toThrow('name is required');
            });

            it('should handle unique constraint violation', async () => {
                db.run.mockRejectedValue(new Error('UNIQUE constraint failed'));

                await expect(contentService.createCategory({ name: 'Duplicate' }))
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

                db.get.mockResolvedValue(mockRow);

                const result = await contentService.getCategoryById('cat-123');

                expect(result).toBeDefined();
                expect(result.id).toBe('cat-123');
                expect(result.name).toBe('Test Category');
                expect(result.isActive).toBe(true);
            });

            it('should return null when category not found', async () => {
                db.get.mockResolvedValue(null);

                const result = await contentService.getCategoryById('non-existent');
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

                db.all.mockResolvedValue(mockRows);

                const result = await contentService.listCategories();

                expect(result).toHaveLength(2);
                expect(result[0].name).toBe('Category 1');
                expect(result[1].name).toBe('Category 2');
            });

            it('should filter by contentType', async () => {
                db.all.mockImplementation(async (query, params) => {
                    expect(query).toContain('content_type');
                    expect(params).toContain('PLAYBOOK');
                    return [];
                });

                // ContentService.listCategories(contentType: string) takes a plain
                // string, not an options object — the aggregator wrapper does
                // `this.categoryService.listCategories({ contentType })` internally.
                await contentService.listCategories('PLAYBOOK');
            });

            // Removed 'should filter by organizationId': ContentService's
            // listCategories() facade only forwards `contentType` to the underlying
            // CategoryService.listCategories({contentType, organizationId, ...})
            // (server/src/services/contentService.ts ~line 90:
            // `listCategories(contentType: string) { return
            // this.categoryService.listCategories({ contentType }); }`) — there is
            // no way to pass organizationId through this facade method anymore.
            // The capability still exists one level down (categoryService directly),
            // just not exposed here. Not a bug — facade was simplified to a single
            // filter param; not restoring the old multi-option signature since that's
            // a product code change.
            it.skip('should filter by organizationId (facade no longer forwards organizationId)', async () => {
                db.all.mockImplementation(async (query, params) => {
                    expect(query).toContain('organization_id');
                    expect(params).toContain('org-123');
                    return [];
                });

                await contentService.listCategories({ organizationId: 'org-123' });
            });
        });

        describe('updateCategory', () => {
            it('should update category fields', async () => {
                db.run.mockResolvedValue({ changes: 1 });
                db.get.mockResolvedValue({ id: 'cat-123', name: 'Updated', is_active: 1 });

                const result = await contentService.updateCategory('cat-123', {
                    name: 'Updated',
                    color: '#FF0000'
                });

                expect(db.run).toHaveBeenCalled();
                expect(result).toBeDefined();
            });
        });

        describe('deleteCategory', () => {
            it('should delete category', async () => {
                db.run.mockResolvedValue({ changes: 1 });

                const result = await contentService.deleteCategory('cat-123');
                expect(result).toBe(true);
            });

            it('should return false if category not found', async () => {
                db.run.mockResolvedValue({ changes: 0 });

                const result = await contentService.deleteCategory('non-existent');
                expect(result).toBe(false);
            });
        });
    });

    describe('Tags', () => {
        describe('createTag', () => {
            it('should create a tag', async () => {
                db.run.mockResolvedValue({ lastID: 1, changes: 1 });

                const result = await contentService.createTag({
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
                await expect(contentService.createTag({})).rejects.toThrow('name is required');
            });
        });

        describe('listTags', () => {
            it('should return list of tags', async () => {
                const mockRows = [
                    { id: 'tag-1', name: 'Tag 1', slug: 'tag-1', color: '#FF0000', usage_count: 5, is_active: 1 },
                    { id: 'tag-2', name: 'Tag 2', slug: 'tag-2', color: '#00FF00', usage_count: 3, is_active: 1 }
                ];

                db.all.mockResolvedValue(mockRows);

                const result = await contentService.listTags();

                expect(result).toHaveLength(2);
                expect(result[0].usageCount).toBe(5);
            });

            it('should support search', async () => {
                db.all.mockImplementation(async (query) => {
                    expect(query).toContain('LIKE');
                    return [];
                });

                await contentService.listTags({ search: 'test' });
            });
        });

        describe('addTagToContent', () => {
            it('should add tag to content and update usage count', async () => {
                let runCount = 0;
                db.run.mockImplementation(async () => {
                    runCount++;
                    return runCount === 1 ? { changes: 1 } : undefined;
                });

                const result = await contentService.addTagToContent(
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
                db.run.mockImplementation(async () => {
                    runCount++;
                    return runCount === 1 ? { changes: 1 } : undefined;
                });

                const result = await contentService.removeTagFromContent(
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
                db.run.mockResolvedValue({ lastID: 1, changes: 1 });

                const result = await contentService.createComment({
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
                await expect(contentService.createComment({}))
                    .rejects.toThrow(/required/);
            });

            it('should handle parent comment for threading', async () => {
                // createComment() calls db.get twice: once to look up the parent
                // comment's thread_id, and once more afterwards to re-fetch the
                // newly-created comment (to include joined user details) — the
                // returned object's fields come from that SECOND fetch, not from
                // the input data directly, so the mock row must include
                // parent_comment_id for the final mapped result to carry it.
                db.get.mockResolvedValue({
                    id: 'cmt-new',
                    thread_id: 'thread-parent',
                    parent_comment_id: 'cmt-parent'
                });
                db.run.mockResolvedValue({ lastID: 1 });

                const result = await contentService.createComment({
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

                db.all.mockResolvedValue(mockRows);

                const result = await contentService.getContentComments('playbook-123', 'PLAYBOOK_TEMPLATE');

                expect(result).toHaveLength(1); // Only root comments at top level
                expect(result[0].replies).toHaveLength(1); // Reply nested
            });
        });

        describe('resolveComment', () => {
            it('should resolve comment', async () => {
                db.run.mockResolvedValue({ changes: 1 });
                db.get.mockResolvedValue({
                    id: 'cmt-123',
                    is_resolved: 1,
                    resolved_by: 'user-456',
                    resolved_at: '2024-01-01T00:00:00Z'
                });

                const result = await contentService.resolveComment('cmt-123', 'user-456');

                expect(result.isResolved).toBe(true);
                expect(result.resolvedBy).toBe('user-456');
            });
        });
    });

    describe('Reviews', () => {
        describe('createReview', () => {
            it('should create a review request', async () => {
                db.run.mockResolvedValue({ lastID: 1, changes: 1 });
                // createReview() re-fetches the row via getReviewById() after
                // inserting (to include joined reviewer/requester names) — the
                // returned object's fields come from that fetch, not the input.
                db.get.mockResolvedValue({
                    id: 'rev-new',
                    content_id: 'playbook-123',
                    content_type: 'PLAYBOOK_TEMPLATE',
                    requested_by: 'user-123',
                    requested_at: '2024-01-01T00:00:00Z',
                    reviewer_id: 'user-456',
                    status: 'PENDING',
                    priority: 'HIGH',
                    due_date: '2024-12-31',
                    created_at: '2024-01-01T00:00:00Z',
                    updated_at: '2024-01-01T00:00:00Z'
                });

                const result = await contentService.createReview({
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
                expect(result.id).toBe('rev-new');
            });

            it('should throw error if required fields missing', async () => {
                await expect(contentService.createReview({}))
                    .rejects.toThrow(/required/);
            });
        });

        describe('updateReviewStatus', () => {
            it('should update review status to APPROVED', async () => {
                db.run.mockResolvedValue({ changes: 1 });
                db.get.mockResolvedValue({
                    id: 'rev-123',
                    status: 'APPROVED',
                    reviewed_at: '2024-01-01T00:00:00Z'
                });

                const result = await contentService.updateReviewStatus(
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

                db.all.mockImplementation(async (query) => {
                    expect(query).toContain('PENDING');
                    expect(query).toContain('IN_REVIEW');
                    expect(query).toContain('priority');
                    return mockRows;
                });

                const result = await contentService.getPendingReviews('user-123');

                expect(result).toHaveLength(2);
            });
        });
    });

    describe('Favorites', () => {
        describe('addFavorite', () => {
            it('should add content to favorites', async () => {
                db.run.mockResolvedValue({ changes: 1 });

                const result = await contentService.addFavorite(
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
                db.run.mockResolvedValue({ changes: 1 });

                const result = await contentService.removeFavorite(
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

                db.all.mockResolvedValue(mockRows);

                const result = await contentService.getUserFavorites('user-123');

                expect(result).toHaveLength(1);
                expect(result[0].contentId).toBe('playbook-1');
            });

            it('should filter by content type', async () => {
                db.all.mockImplementation(async (query, params) => {
                    expect(query).toContain('content_type');
                    expect(params).toContain('PLAYBOOK_TEMPLATE');
                    return [];
                });

                await contentService.getUserFavorites('user-123', { contentType: 'PLAYBOOK_TEMPLATE' });
            });
        });

        describe('isFavorited', () => {
            it('should return true if favorited', async () => {
                db.get.mockResolvedValue({ 1: 1 });

                const result = await contentService.isFavorited(
                    'user-123',
                    'playbook-456',
                    'PLAYBOOK_TEMPLATE'
                );

                expect(result).toBe(true);
            });

            it('should return false if not favorited', async () => {
                db.get.mockResolvedValue(null);

                const result = await contentService.isFavorited(
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
                db.run.mockResolvedValue({ lastID: 1 });

                const result = await contentService.logAnalyticsEvent({
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
                db.get.mockResolvedValue({
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

                const result = await contentService.getContentAnalytics(
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
                // Mock multiple db.get calls, branching on query content
                db.get.mockImplementation(async (query) => {
                    if (query.includes('ai_playbook_templates')) {
                        return {
                            published_playbooks: 10,
                            total_playbooks: 15,
                            published_emails: 5,
                            total_emails: 8,
                            total_categories: 3,
                            total_tags: 12
                        };
                    } else if (query.includes('ai_playbook_runs')) {
                        return {
                            total_runs: 100,
                            completed_runs: 85,
                            failed_runs: 10
                        };
                    } else if (query.includes('email_sends')) {
                        return {
                            total_sends: 500,
                            opened: 200,
                            clicked: 50
                        };
                    }
                    return {};
                });

                const result = await contentService.getAnalyticsDashboard();

                expect(result).toBeDefined();
                expect(result.totalPlaybookTemplates).toBeDefined();
                expect(result.avgPlaybookSuccessRate).toBeDefined();
            });
        });
    });

    describe('Global Search', () => {
        describe('searchContent', () => {
            it('should search across playbooks and emails', async () => {
                db.all.mockImplementation(async (query) => {
                    if (query.includes('ai_playbook_templates')) {
                        return [
                            {
                                id: 'pb-1',
                                key: 'playbook-1',
                                title: 'Test Playbook',
                                status: 'PUBLISHED',
                                created_at: '2024-01-01'
                            }
                        ];
                    } else if (query.includes('email_templates')) {
                        return [
                            {
                                id: 'em-1',
                                template_key: 'email-1',
                                name: 'Test Email',
                                status: 'PUBLISHED',
                                created_at: '2024-01-02'
                            }
                        ];
                    }
                    return [];
                });

                const result = await contentService.searchContent({
                    query: 'test',
                    contentTypes: ['PLAYBOOK_TEMPLATE', 'EMAIL_TEMPLATE']
                });

                expect(result.items).toHaveLength(2);
                expect(result.total).toBe(2);
            });

            it('should filter by status', async () => {
                db.all.mockImplementation(async (query) => {
                    expect(query).toContain('status');
                    return [];
                });

                await contentService.searchContent({
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

                db.all.mockImplementation(async (query) => {
                    if (query.includes('ai_playbook_templates')) {
                        return mockPlaybooks;
                    }
                    return [];
                });

                const result = await contentService.searchContent({
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
            // _camelToSnake is a private helper on the CategoryService sub-service
            // (TS `private` is compile-time only; the instance is publicly reachable
            // via contentService.categoryService at runtime).
            expect(contentService.categoryService._camelToSnake('contentType')).toBe('content_type');
            expect(contentService.categoryService._camelToSnake('isActive')).toBe('is_active');
            expect(contentService.categoryService._camelToSnake('parentId')).toBe('parent_id');
        });
    });
});
