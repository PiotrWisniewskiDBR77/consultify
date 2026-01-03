/**
 * Content Service
 * Shared functionality for Content Module: categories, tags, comments, reviews,
 * analytics, favorites, and permissions.
 * 
 * Part of Content Module Enterprise Extension
 * 
 * Fully migrated from server/services/contentService.js to TypeScript
 */

import type { IDatabase, RunResult } from '../database/IDatabase.js';
import { getDatabase } from '../database/Database.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/Logger.js';

// ==========================================
// CONSTANTS
// ==========================================

export const CONTENT_TYPES = {
    PLAYBOOK_TEMPLATE: 'PLAYBOOK_TEMPLATE',
    EMAIL_TEMPLATE: 'EMAIL_TEMPLATE',
    CATEGORY: 'CATEGORY'
} as const;

export const REVIEW_STATUSES = {
    PENDING: 'PENDING',
    IN_REVIEW: 'IN_REVIEW',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    CHANGES_REQUESTED: 'CHANGES_REQUESTED'
} as const;

export const REVIEW_PRIORITIES = {
    LOW: 'LOW',
    NORMAL: 'NORMAL',
    HIGH: 'HIGH',
    URGENT: 'URGENT'
} as const;

// ==========================================
// TYPE DEFINITIONS
// ==========================================

export interface CategoryRecord {
    id: string;
    name: string;
    slug: string;
    description: string;
    content_type: string;
    parent_id?: string | null;
    sort_order: number;
    color: string;
    icon: string;
    organization_id?: string | null;
    is_active: number;
    created_at?: string;
    updated_at?: string;
    created_by?: string | null;
}

export interface Category {
    id: string;
    name: string;
    slug: string;
    description: string;
    contentType: string;
    parentId?: string | null;
    sortOrder: number;
    color: string;
    icon: string;
    organizationId?: string | null;
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string;
    createdBy?: string | null;
    children?: Category[];
}

export interface CreateCategoryData {
    name: string;
    slug?: string | null;
    description?: string;
    contentType?: string;
    parentId?: string | null;
    sortOrder?: number;
    color?: string;
    icon?: string;
    organizationId?: string | null;
    createdBy?: string | null;
}

export interface UpdateCategoryData {
    name?: string;
    slug?: string;
    description?: string;
    contentType?: string;
    parentId?: string | null;
    sortOrder?: number;
    color?: string;
    icon?: string;
    isActive?: boolean;
}

export interface ListCategoriesOptions {
    contentType?: string | null;
    organizationId?: string | null;
    parentId?: string | null | undefined;
    includeInactive?: boolean;
}

export interface TagRecord {
    id: string;
    name: string;
    slug: string;
    content_type: string;
    color: string;
    organization_id?: string | null;
    usage_count: number;
    is_active: number;
    created_at?: string;
    created_by?: string | null;
}

export interface Tag {
    id: string;
    name: string;
    slug: string;
    contentType: string;
    color: string;
    organizationId?: string | null;
    usageCount: number;
    isActive: boolean;
    createdAt?: string;
    createdBy?: string | null;
}

export interface CreateTagData {
    name: string;
    slug?: string | null;
    contentType?: string;
    color?: string;
    organizationId?: string | null;
    createdBy?: string | null;
}

export interface UpdateTagData {
    name?: string;
    slug?: string;
    color?: string;
    isActive?: boolean;
}

export interface ListTagsOptions {
    contentType?: string | null;
    organizationId?: string | null;
    search?: string | null;
    includeInactive?: boolean;
    sortBy?: string;
    limit?: number;
}

export interface CommentRecord {
    id: string;
    content_id: string;
    content_type: string;
    user_id: string;
    comment_text: string;
    parent_comment_id?: string | null;
    thread_id: string;
    position_ref?: string | null;
    mentioned_user_ids?: string | null;
    is_resolved: number;
    resolved_by?: string | null;
    resolved_at?: string | null;
    is_edited: number;
    edited_at?: string | null;
    created_at?: string;
    updated_at?: string;
    first_name?: string;
    last_name?: string;
    avatar?: string;
}

export interface Comment {
    id: string;
    contentId: string;
    contentType: string;
    userId: string;
    commentText: string;
    parentCommentId?: string | null;
    threadId: string;
    positionRef?: string | null;
    mentionedUserIds: string[];
    isResolved: boolean;
    resolvedBy?: string | null;
    resolvedAt?: string | null;
    isEdited: boolean;
    editedAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
    user?: {
        id: string;
        firstName: string;
        lastName: string;
        avatar?: string | null;
    } | null;
    replies?: Comment[];
}

export interface CreateCommentData {
    contentId: string;
    contentType: string;
    userId: string;
    commentText: string;
    parentCommentId?: string | null;
    positionRef?: string | null;
    mentionedUserIds?: string[];
}

export interface GetContentCommentsOptions {
    includeResolved?: boolean;
}

export interface ReviewRecord {
    id: string;
    content_id: string;
    content_type: string;
    requested_by: string;
    requested_at: string;
    reviewer_id: string;
    status: string;
    review_notes?: string | null;
    checklist_items?: string | null;
    reviewed_at?: string | null;
    version_at_review?: string | null;
    priority: string;
    due_date?: string | null;
    created_at?: string;
    updated_at?: string;
    requester_first_name?: string;
    requester_last_name?: string;
    reviewer_first_name?: string;
    reviewer_last_name?: string;
}

export interface Review {
    id: string;
    contentId: string;
    contentType: string;
    requestedBy: string;
    requestedAt: string;
    reviewerId: string;
    status: string;
    reviewNotes?: string | null;
    checklistItems: unknown[];
    reviewedAt?: string | null;
    versionAtReview?: string | null;
    priority: string;
    dueDate?: string | null;
    createdAt?: string;
    updatedAt?: string;
    requester?: {
        id: string;
        firstName: string;
        lastName: string;
    } | null;
    reviewer?: {
        id: string;
        firstName: string;
        lastName: string;
    } | null;
}

export interface CreateReviewData {
    contentId: string;
    contentType: string;
    requestedBy: string;
    reviewerId: string;
    priority?: string;
    dueDate?: string | null;
    checklistItems?: unknown[];
    versionAtReview?: string | null;
}

export interface Favorite {
    id: string;
    userId: string;
    contentId: string;
    contentType: string;
    notes?: string | null;
    folderName: string;
    createdAt: string;
}

export interface AddFavoriteOptions {
    notes?: string | null;
    folderName?: string;
}

export interface GetUserFavoritesOptions {
    contentType?: string | null;
    folderName?: string | null;
}

export interface AnalyticsEvent {
    id: string;
    contentId: string;
    contentType: string;
    eventType: string;
    userId?: string | null;
    organizationId?: string | null;
    metadata: Record<string, unknown>;
    sessionId?: string | null;
    durationMs?: number | null;
    createdAt: string;
}

export interface LogAnalyticsEventData {
    contentId: string;
    contentType: string;
    eventType: string;
    userId?: string | null;
    organizationId?: string | null;
    metadata?: Record<string, unknown>;
    sessionId?: string | null;
    durationMs?: number | null;
}

export interface GetContentAnalyticsOptions {
    dateFrom?: string | null;
    dateTo?: string | null;
}

export interface ContentAnalytics {
    contentId: string;
    contentType: string;
    totalEvents: number;
    uniqueUsers: number;
    uniqueOrgs: number;
    views: number;
    edits: number;
    uses: number;
    exports: number;
    clones: number;
    firstInteraction?: string | null;
    lastInteraction?: string | null;
}

export interface AnalyticsDashboard {
    totalPlaybookTemplates: number;
    totalEmailTemplates: number;
    totalCategories: number;
    totalTags: number;
    publishedPlaybooks: number;
    publishedEmails: number;
    totalPlaybookRuns: number;
    totalEmailsSent: number;
    avgPlaybookSuccessRate: number;
    avgEmailOpenRate: number;
    avgEmailClickRate: number;
}

export interface SearchContentOptions {
    query?: string;
    contentTypes?: string[];
    statuses?: string[];
    categoryIds?: string[];
    tagIds?: string[];
    organizationId?: string | null;
    sortBy?: string;
    sortOrder?: string;
    page?: number;
    limit?: number;
}

export interface SearchResults {
    items: Array<{
        id: string;
        contentType: string;
        key?: string;
        title: string;
        description?: string;
        status?: string;
        version?: number;
        categoryId?: string | null;
        createdAt?: string;
        updatedAt?: string;
    }>;
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
}

// Dependency injection interface for testing
export interface ContentServiceDependencies {
    db: IDatabase;
    uuidv4: () => string;
}

// ==========================================
// SERVICE IMPLEMENTATION
// ==========================================

class ContentServiceClass {
    private deps: ContentServiceDependencies;

    constructor(deps?: Partial<ContentServiceDependencies>) {
        this.deps = {
            db: deps?.db ?? getDatabase(),
            uuidv4: deps?.uuidv4 ?? uuidv4
        };
    }

    /**
     * Set dependencies (for testing)
     */
    setDependencies(newDeps: Partial<ContentServiceDependencies>): void {
        this.deps = { ...this.deps, ...newDeps };
    }

    // ==========================================
    // CATEGORIES
    // ==========================================

    async createCategory(data: CreateCategoryData): Promise<Category> {
        const {
            name,
            slug = null,
            description = '',
            contentType = 'ALL',
            parentId = null,
            sortOrder = 0,
            color = '#6366F1',
            icon = 'folder',
            organizationId = null,
            createdBy = null
        } = data;

        if (!name) {
            throw new Error('name is required');
        }

        const id = `cat-${this.deps.uuidv4()}`;
        const categorySlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const now = new Date().toISOString();

        try {
            await this.deps.db.run(
                `INSERT INTO content_categories (
                    id, name, slug, description, content_type, parent_id,
                    sort_order, color, icon, organization_id, is_active,
                    created_at, updated_at, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
                [
                    id, name, categorySlug, description, contentType, parentId,
                    sortOrder, color, icon, organizationId, now, now, createdBy
                ]
            );
        } catch (err) {
            const error = err as Error;
            if (error.message.includes('UNIQUE')) {
                throw new Error(`Category with slug '${categorySlug}' already exists`);
            }
            throw err;
        }

        return {
            id,
            name,
            slug: categorySlug,
            description,
            contentType,
            parentId,
            sortOrder,
            color,
            icon,
            organizationId,
            isActive: true,
            createdAt: now,
            updatedAt: now,
            createdBy
        };
    }

    async getCategoryById(id: string): Promise<Category | null> {
        const row = await this.deps.db.get<CategoryRecord>(
            'SELECT * FROM content_categories WHERE id = ?',
            [id]
        ) as CategoryRecord | null;

        if (!row) return null;
        return this._mapCategoryRow(row);
    }

    async listCategories(options: ListCategoriesOptions = {}): Promise<Category[]> {
        const { contentType = null, organizationId = null, parentId = undefined, includeInactive = false } = options;
        const conditions: string[] = [];
        const params: unknown[] = [];

        if (contentType) {
            conditions.push("(content_type = ? OR content_type = 'ALL')");
            params.push(contentType);
        }

        if (organizationId !== null) {
            conditions.push('(organization_id = ? OR organization_id IS NULL)');
            params.push(organizationId);
        }

        if (parentId !== undefined) {
            if (parentId === null) {
                conditions.push('parent_id IS NULL');
            } else {
                conditions.push('parent_id = ?');
                params.push(parentId);
            }
        }

        if (!includeInactive) {
            conditions.push('is_active = 1');
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const rows = await this.deps.db.all<CategoryRecord>(
            `SELECT * FROM content_categories ${whereClause} ORDER BY sort_order, name`,
            params
        ) as CategoryRecord[];

        return (rows || []).map(row => this._mapCategoryRow(row));
    }

    async updateCategory(id: string, updates: UpdateCategoryData): Promise<Category> {
        const allowedFields = ['name', 'slug', 'description', 'contentType', 'parentId', 'sortOrder', 'color', 'icon', 'isActive'];
        const setClauses: string[] = [];
        const values: unknown[] = [];

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                const dbColumn = this._camelToSnake(key);
                setClauses.push(`${dbColumn} = ?`);
                values.push(key === 'isActive' ? (value ? 1 : 0) : value);
            }
        }

        if (setClauses.length === 0) {
            const existing = await this.getCategoryById(id);
            if (!existing) {
                throw new Error('Category not found');
            }
            return existing;
        }

        setClauses.push('updated_at = ?');
        values.push(new Date().toISOString());
        values.push(id);

        await this.deps.db.run(
            `UPDATE content_categories SET ${setClauses.join(', ')} WHERE id = ?`,
            values
        );

        const updated = await this.getCategoryById(id);
        if (!updated) {
            throw new Error('Failed to retrieve updated category');
        }
        return updated;
    }

    async deleteCategory(id: string): Promise<boolean> {
        const result = await this.deps.db.run(
            'DELETE FROM content_categories WHERE id = ?',
            [id]
        ) as RunResult;

        return result.changes > 0;
    }

    async getCategoryTree(options: ListCategoriesOptions = {}): Promise<Category[]> {
        const categories = await this.listCategories(options);
        
        const buildTree = (parentId: string | null = null): Category[] => {
            return categories
                .filter(cat => cat.parentId === parentId)
                .map(cat => ({
                    ...cat,
                    children: buildTree(cat.id)
                }));
        };

        return buildTree(null);
    }

    // ==========================================
    // TAGS
    // ==========================================

    async createTag(data: CreateTagData): Promise<Tag> {
        const {
            name,
            slug = null,
            contentType = 'ALL',
            color = '#10B981',
            organizationId = null,
            createdBy = null
        } = data;

        if (!name) {
            throw new Error('name is required');
        }

        const id = `tag-${this.deps.uuidv4()}`;
        const tagSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const now = new Date().toISOString();

        try {
            await this.deps.db.run(
                `INSERT INTO content_tags (
                    id, name, slug, content_type, color, organization_id,
                    usage_count, is_active, created_at, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?)`,
                [id, name, tagSlug, contentType, color, organizationId, now, createdBy]
            );
        } catch (err) {
            const error = err as Error;
            if (error.message.includes('UNIQUE')) {
                throw new Error(`Tag with slug '${tagSlug}' already exists`);
            }
            throw err;
        }

        return {
            id,
            name,
            slug: tagSlug,
            contentType,
            color,
            organizationId,
            usageCount: 0,
            isActive: true,
            createdAt: now,
            createdBy
        };
    }

    async getTagById(id: string): Promise<Tag | null> {
        const row = await this.deps.db.get<TagRecord>(
            'SELECT * FROM content_tags WHERE id = ?',
            [id]
        ) as TagRecord | null;

        if (!row) return null;
        return this._mapTagRow(row);
    }

    async listTags(options: ListTagsOptions = {}): Promise<Tag[]> {
        const {
            contentType = null,
            organizationId = null,
            search = null,
            includeInactive = false,
            sortBy = 'name',
            limit = 100
        } = options;

        const conditions: string[] = [];
        const params: unknown[] = [];

        if (contentType) {
            conditions.push("(content_type = ? OR content_type = 'ALL')");
            params.push(contentType);
        }

        if (organizationId !== null) {
            conditions.push('(organization_id = ? OR organization_id IS NULL)');
            params.push(organizationId);
        }

        if (search) {
            conditions.push('(name LIKE ? OR slug LIKE ?)');
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm);
        }

        if (!includeInactive) {
            conditions.push('is_active = 1');
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const validSortColumns = ['name', 'usage_count', 'created_at'];
        const orderBy = validSortColumns.includes(sortBy) ? sortBy : 'name';

        const rows = await this.deps.db.all<TagRecord>(
            `SELECT * FROM content_tags ${whereClause} ORDER BY ${orderBy} DESC LIMIT ?`,
            [...params, limit]
        ) as TagRecord[];

        return (rows || []).map(row => this._mapTagRow(row));
    }

    async updateTag(id: string, updates: UpdateTagData): Promise<Tag> {
        const allowedFields = ['name', 'slug', 'color', 'isActive'];
        const setClauses: string[] = [];
        const values: unknown[] = [];

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                const dbColumn = this._camelToSnake(key);
                setClauses.push(`${dbColumn} = ?`);
                values.push(key === 'isActive' ? (value ? 1 : 0) : value);
            }
        }

        if (setClauses.length === 0) {
            const existing = await this.getTagById(id);
            if (!existing) {
                throw new Error('Tag not found');
            }
            return existing;
        }

        values.push(id);

        await this.deps.db.run(
            `UPDATE content_tags SET ${setClauses.join(', ')} WHERE id = ?`,
            values
        );

        const updated = await this.getTagById(id);
        if (!updated) {
            throw new Error('Failed to retrieve updated tag');
        }
        return updated;
    }

    async deleteTag(id: string): Promise<boolean> {
        await this.deps.db.run('DELETE FROM content_tag_mappings WHERE tag_id = ?', [id]);
        const result = await this.deps.db.run('DELETE FROM content_tags WHERE id = ?', [id]) as RunResult;
        return result.changes > 0;
    }

    async getContentTags(contentId: string, contentType: string): Promise<Tag[]> {
        const rows = await this.deps.db.all<TagRecord>(
            `SELECT ct.* FROM content_tags ct
             JOIN content_tag_mappings ctm ON ct.id = ctm.tag_id
             WHERE ctm.content_id = ? AND ctm.content_type = ?`,
            [contentId, contentType]
        ) as TagRecord[];

        return (rows || []).map(row => this._mapTagRow(row));
    }

    async addTagToContent(contentId: string, contentType: string, tagId: string, userId: string | null = null): Promise<boolean> {
        const id = `ctm-${this.deps.uuidv4()}`;
        const now = new Date().toISOString();

        const result = await this.deps.db.run(
            `INSERT OR IGNORE INTO content_tag_mappings (id, content_id, content_type, tag_id, created_at, created_by)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, contentId, contentType, tagId, now, userId]
        ) as RunResult;

        if (result.changes > 0) {
            await this.deps.db.run(
                'UPDATE content_tags SET usage_count = usage_count + 1 WHERE id = ?',
                [tagId]
            );
            return true;
        }
        return false;
    }

    async removeTagFromContent(contentId: string, contentType: string, tagId: string): Promise<boolean> {
        const result = await this.deps.db.run(
            `DELETE FROM content_tag_mappings WHERE content_id = ? AND content_type = ? AND tag_id = ?`,
            [contentId, contentType, tagId]
        ) as RunResult;

        if (result.changes > 0) {
            await this.deps.db.run(
                'UPDATE content_tags SET usage_count = MAX(0, usage_count - 1) WHERE id = ?',
                [tagId]
            );
            return true;
        }
        return false;
    }

    // ==========================================
    // COMMENTS
    // ==========================================

    async createComment(data: CreateCommentData): Promise<Comment> {
        const {
            contentId,
            contentType,
            userId,
            commentText,
            parentCommentId = null,
            positionRef = null,
            mentionedUserIds = []
        } = data;

        if (!contentId || !contentType || !userId || !commentText) {
            throw new Error('contentId, contentType, userId, and commentText are required');
        }

        const id = `cmt-${this.deps.uuidv4()}`;
        const now = new Date().toISOString();
        
        let threadId = id;
        if (parentCommentId) {
            const parent = await this.getCommentById(parentCommentId);
            threadId = parent?.threadId || parentCommentId;
        }

        await this.deps.db.run(
            `INSERT INTO content_comments (
                id, content_id, content_type, user_id, comment_text,
                parent_comment_id, thread_id, position_ref, mentioned_user_ids,
                is_resolved, is_edited, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
            [
                id, contentId, contentType, userId, commentText,
                parentCommentId, threadId, positionRef, JSON.stringify(mentionedUserIds),
                now, now
            ]
        );

        return {
            id,
            contentId,
            contentType,
            userId,
            commentText,
            parentCommentId,
            threadId,
            positionRef,
            mentionedUserIds,
            isResolved: false,
            resolvedBy: null,
            resolvedAt: null,
            isEdited: false,
            editedAt: null,
            createdAt: now,
            updatedAt: now
        };
    }

    async getCommentById(id: string): Promise<Comment | null> {
        const row = await this.deps.db.get<CommentRecord>(
            `SELECT cc.*, u.first_name, u.last_name, u.avatar
             FROM content_comments cc
             LEFT JOIN users u ON cc.user_id = u.id
             WHERE cc.id = ?`,
            [id]
        ) as CommentRecord | null;

        if (!row) return null;
        return this._mapCommentRow(row);
    }

    async getContentComments(contentId: string, contentType: string, options: GetContentCommentsOptions = {}): Promise<Comment[]> {
        const { includeResolved = true } = options;
        const conditions: string[] = ['cc.content_id = ?', 'cc.content_type = ?'];
        const params: unknown[] = [contentId, contentType];

        if (!includeResolved) {
            conditions.push('cc.is_resolved = 0');
        }

        const rows = await this.deps.db.all<CommentRecord>(
            `SELECT cc.*, u.first_name, u.last_name, u.avatar
             FROM content_comments cc
             LEFT JOIN users u ON cc.user_id = u.id
             WHERE ${conditions.join(' AND ')}
             ORDER BY cc.created_at ASC`,
            params
        ) as CommentRecord[];

        const comments = (rows || []).map(row => this._mapCommentRow(row));
        
        // Build threaded structure
        const rootComments = comments.filter(c => !c.parentCommentId);
        const getReplies = (parentId: string): Comment[] => {
            return comments
                .filter(c => c.parentCommentId === parentId)
                .map(c => ({
                    ...c,
                    replies: getReplies(c.id)
                }));
        };

        return rootComments.map(c => ({
            ...c,
            replies: getReplies(c.id)
        }));
    }

    async updateComment(id: string, commentText: string, userId: string): Promise<Comment> {
        const comment = await this.getCommentById(id);
        
        if (!comment) {
            throw new Error(`Comment ${id} not found`);
        }

        if (comment.userId !== userId) {
            throw new Error('Can only edit your own comments');
        }

        const now = new Date().toISOString();

        await this.deps.db.run(
            `UPDATE content_comments SET comment_text = ?, is_edited = 1, edited_at = ?, updated_at = ? WHERE id = ?`,
            [commentText, now, now, id]
        );

        const updated = await this.getCommentById(id);
        if (!updated) {
            throw new Error('Failed to retrieve updated comment');
        }
        return updated;
    }

    async resolveComment(id: string, userId: string): Promise<Comment> {
        const now = new Date().toISOString();

        await this.deps.db.run(
            `UPDATE content_comments SET is_resolved = 1, resolved_by = ?, resolved_at = ?, updated_at = ? WHERE id = ?`,
            [userId, now, now, id]
        );

        const updated = await this.getCommentById(id);
        if (!updated) {
            throw new Error('Failed to retrieve resolved comment');
        }
        return updated;
    }

    async deleteComment(id: string): Promise<boolean> {
        const result = await this.deps.db.run('DELETE FROM content_comments WHERE id = ?', [id]) as RunResult;
        return result.changes > 0;
    }

    // ==========================================
    // REVIEWS
    // ==========================================

    async createReview(data: CreateReviewData): Promise<Review> {
        const {
            contentId,
            contentType,
            requestedBy,
            reviewerId,
            priority = 'NORMAL',
            dueDate = null,
            checklistItems = [],
            versionAtReview = null
        } = data;

        if (!contentId || !contentType || !requestedBy || !reviewerId) {
            throw new Error('contentId, contentType, requestedBy, and reviewerId are required');
        }

        const id = `rev-${this.deps.uuidv4()}`;
        const now = new Date().toISOString();

        await this.deps.db.run(
            `INSERT INTO content_reviews (
                id, content_id, content_type, requested_by, requested_at,
                reviewer_id, status, checklist_items, version_at_review,
                priority, due_date, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?)`,
            [
                id, contentId, contentType, requestedBy, now,
                reviewerId, JSON.stringify(checklistItems), versionAtReview,
                priority, dueDate, now, now
            ]
        );

        const created = await this.getReviewById(id);
        if (!created) {
            throw new Error('Failed to retrieve created review');
        }
        return created;
    }

    async getReviewById(id: string): Promise<Review | null> {
        const row = await this.deps.db.get<ReviewRecord>(
            `SELECT cr.*,
                req.first_name as requester_first_name, req.last_name as requester_last_name,
                rev.first_name as reviewer_first_name, rev.last_name as reviewer_last_name
             FROM content_reviews cr
             LEFT JOIN users req ON cr.requested_by = req.id
             LEFT JOIN users rev ON cr.reviewer_id = rev.id
             WHERE cr.id = ?`,
            [id]
        ) as ReviewRecord | null;

        if (!row) return null;
        return this._mapReviewRow(row);
    }

    async getContentReviews(contentId: string, contentType: string): Promise<Review[]> {
        const rows = await this.deps.db.all<ReviewRecord>(
            `SELECT cr.*,
                req.first_name as requester_first_name, req.last_name as requester_last_name,
                rev.first_name as reviewer_first_name, rev.last_name as reviewer_last_name
             FROM content_reviews cr
             LEFT JOIN users req ON cr.requested_by = req.id
             LEFT JOIN users rev ON cr.reviewer_id = rev.id
             WHERE cr.content_id = ? AND cr.content_type = ?
             ORDER BY cr.created_at DESC`,
            [contentId, contentType]
        ) as ReviewRecord[];

        return (rows || []).map(row => this._mapReviewRow(row));
    }

    async getPendingReviews(reviewerId: string): Promise<Review[]> {
        const rows = await this.deps.db.all<ReviewRecord>(
            `SELECT cr.*,
                req.first_name as requester_first_name, req.last_name as requester_last_name
             FROM content_reviews cr
             LEFT JOIN users req ON cr.requested_by = req.id
             WHERE cr.reviewer_id = ? AND cr.status IN ('PENDING', 'IN_REVIEW')
             ORDER BY 
                CASE cr.priority 
                    WHEN 'URGENT' THEN 1 
                    WHEN 'HIGH' THEN 2 
                    WHEN 'NORMAL' THEN 3 
                    ELSE 4 
                END,
                cr.due_date ASC`,
            [reviewerId]
        ) as ReviewRecord[];

        return (rows || []).map(row => this._mapReviewRow(row));
    }

    async updateReviewStatus(id: string, status: string, reviewNotes: string | null = null, checklistItems: unknown[] | null = null): Promise<Review> {
        const now = new Date().toISOString();
        const setClauses: string[] = ['status = ?', 'updated_at = ?'];
        const values: unknown[] = [status, now];

        if (reviewNotes !== null) {
            setClauses.push('review_notes = ?');
            values.push(reviewNotes);
        }

        if (checklistItems !== null) {
            setClauses.push('checklist_items = ?');
            values.push(JSON.stringify(checklistItems));
        }

        if (status === REVIEW_STATUSES.APPROVED || status === REVIEW_STATUSES.REJECTED || status === REVIEW_STATUSES.CHANGES_REQUESTED) {
            setClauses.push('reviewed_at = ?');
            values.push(now);
        }

        values.push(id);

        await this.deps.db.run(
            `UPDATE content_reviews SET ${setClauses.join(', ')} WHERE id = ?`,
            values
        );

        const updated = await this.getReviewById(id);
        if (!updated) {
            throw new Error('Failed to retrieve updated review');
        }
        return updated;
    }

    async approveReview(reviewId: string, reviewNotes: string | null = null): Promise<Review> {
        return this.updateReviewStatus(reviewId, REVIEW_STATUSES.APPROVED, reviewNotes);
    }

    async rejectReview(reviewId: string, reviewNotes: string): Promise<Review> {
        return this.updateReviewStatus(reviewId, REVIEW_STATUSES.REJECTED, reviewNotes);
    }

    async requestChanges(reviewId: string, reviewNotes: string): Promise<Review> {
        return this.updateReviewStatus(reviewId, REVIEW_STATUSES.CHANGES_REQUESTED, reviewNotes);
    }

    // ==========================================
    // FAVORITES
    // ==========================================

    async addFavorite(userId: string, contentId: string, contentType: string, options: AddFavoriteOptions = {}): Promise<Favorite> {
        const { notes = null, folderName = 'Default' } = options;
        const id = `fav-${this.deps.uuidv4()}`;
        const now = new Date().toISOString();

        await this.deps.db.run(
            `INSERT OR IGNORE INTO content_favorites (id, user_id, content_id, content_type, notes, folder_name, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, userId, contentId, contentType, notes, folderName, now]
        );

        return {
            id,
            userId,
            contentId,
            contentType,
            notes,
            folderName,
            createdAt: now
        };
    }

    async removeFavorite(userId: string, contentId: string, contentType: string): Promise<boolean> {
        const result = await this.deps.db.run(
            'DELETE FROM content_favorites WHERE user_id = ? AND content_id = ? AND content_type = ?',
            [userId, contentId, contentType]
        ) as RunResult;

        return result.changes > 0;
    }

    async getUserFavorites(userId: string, options: GetUserFavoritesOptions = {}): Promise<Favorite[]> {
        const { contentType = null, folderName = null } = options;
        const conditions: string[] = ['user_id = ?'];
        const params: unknown[] = [userId];

        if (contentType) {
            conditions.push('content_type = ?');
            params.push(contentType);
        }

        if (folderName) {
            conditions.push('folder_name = ?');
            params.push(folderName);
        }

        const rows = await this.deps.db.all<{
            id: string;
            user_id: string;
            content_id: string;
            content_type: string;
            notes?: string | null;
            folder_name: string;
            created_at: string;
        }>(
            `SELECT * FROM content_favorites WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
            params
        ) as Array<{
            id: string;
            user_id: string;
            content_id: string;
            content_type: string;
            notes?: string | null;
            folder_name: string;
            created_at: string;
        }>;

        return (rows || []).map(row => ({
            id: row.id,
            userId: row.user_id,
            contentId: row.content_id,
            contentType: row.content_type,
            notes: row.notes,
            folderName: row.folder_name,
            createdAt: row.created_at
        }));
    }

    async isFavorited(userId: string, contentId: string, contentType: string): Promise<boolean> {
        const row = await this.deps.db.get<{ '1': number }>(
            'SELECT 1 FROM content_favorites WHERE user_id = ? AND content_id = ? AND content_type = ?',
            [userId, contentId, contentType]
        ) as { '1': number } | null;

        return !!row;
    }

    // ==========================================
    // ANALYTICS
    // ==========================================

    async logAnalyticsEvent(data: LogAnalyticsEventData): Promise<AnalyticsEvent> {
        const {
            contentId,
            contentType,
            eventType,
            userId = null,
            organizationId = null,
            metadata = {},
            sessionId = null,
            durationMs = null
        } = data;

        const id = `ca-${this.deps.uuidv4()}`;
        const now = new Date().toISOString();

        await this.deps.db.run(
            `INSERT INTO content_analytics (
                id, content_id, content_type, event_type, user_id, organization_id,
                metadata, session_id, duration_ms, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, contentId, contentType, eventType, userId, organizationId, JSON.stringify(metadata), sessionId, durationMs, now]
        );

        return {
            id,
            contentId,
            contentType,
            eventType,
            userId,
            organizationId,
            metadata,
            sessionId,
            durationMs,
            createdAt: now
        };
    }

    async getContentAnalytics(contentId: string, contentType: string, options: GetContentAnalyticsOptions = {}): Promise<ContentAnalytics> {
        const { dateFrom = null, dateTo = null } = options;
        const conditions: string[] = ['content_id = ?', 'content_type = ?'];
        const params: unknown[] = [contentId, contentType];

        if (dateFrom) {
            conditions.push('created_at >= ?');
            params.push(dateFrom);
        }

        if (dateTo) {
            conditions.push('created_at <= ?');
            params.push(dateTo);
        }

        const stats = await this.deps.db.get<{
            total_events: number;
            unique_users: number;
            unique_orgs: number;
            views: number;
            edits: number;
            uses: number;
            exports: number;
            clones: number;
            first_interaction?: string | null;
            last_interaction?: string | null;
        }>(
            `SELECT 
                COUNT(*) as total_events,
                COUNT(DISTINCT user_id) as unique_users,
                COUNT(DISTINCT organization_id) as unique_orgs,
                SUM(CASE WHEN event_type = 'VIEW' THEN 1 ELSE 0 END) as views,
                SUM(CASE WHEN event_type = 'EDIT' THEN 1 ELSE 0 END) as edits,
                SUM(CASE WHEN event_type = 'USE' THEN 1 ELSE 0 END) as uses,
                SUM(CASE WHEN event_type = 'EXPORT' THEN 1 ELSE 0 END) as exports,
                SUM(CASE WHEN event_type = 'CLONE' THEN 1 ELSE 0 END) as clones,
                MIN(created_at) as first_interaction,
                MAX(created_at) as last_interaction
             FROM content_analytics
             WHERE ${conditions.join(' AND ')}`,
            params
        ) as {
            total_events: number;
            unique_users: number;
            unique_orgs: number;
            views: number;
            edits: number;
            uses: number;
            exports: number;
            clones: number;
            first_interaction?: string | null;
            last_interaction?: string | null;
        } | null;

        return {
            contentId,
            contentType,
            totalEvents: stats?.total_events || 0,
            uniqueUsers: stats?.unique_users || 0,
            uniqueOrgs: stats?.unique_orgs || 0,
            views: stats?.views || 0,
            edits: stats?.edits || 0,
            uses: stats?.uses || 0,
            exports: stats?.exports || 0,
            clones: stats?.clones || 0,
            firstInteraction: stats?.first_interaction,
            lastInteraction: stats?.last_interaction
        };
    }

    async getAnalyticsDashboard(options: { organizationId?: string | null; dateFrom?: string | null; dateTo?: string | null } = {}): Promise<AnalyticsDashboard> {
        const totals = await this.deps.db.get<{
            published_playbooks: number;
            total_playbooks: number;
            published_emails: number;
            total_emails: number;
            total_categories: number;
            total_tags: number;
        }>(
            `SELECT 
                (SELECT COUNT(*) FROM ai_playbook_templates WHERE status = 'PUBLISHED') as published_playbooks,
                (SELECT COUNT(*) FROM ai_playbook_templates) as total_playbooks,
                (SELECT COUNT(*) FROM email_templates WHERE status = 'PUBLISHED') as published_emails,
                (SELECT COUNT(*) FROM email_templates) as total_emails,
                (SELECT COUNT(*) FROM content_categories WHERE is_active = 1) as total_categories,
                (SELECT COUNT(*) FROM content_tags WHERE is_active = 1) as total_tags`,
            []
        ) as {
            published_playbooks: number;
            total_playbooks: number;
            published_emails: number;
            total_emails: number;
            total_categories: number;
            total_tags: number;
        } | null;

        const playbookStats = await this.deps.db.get<{
            total_runs: number;
            completed_runs: number;
            failed_runs: number;
        }>(
            `SELECT 
                COUNT(*) as total_runs,
                SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_runs,
                SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_runs
             FROM ai_playbook_runs`,
            []
        ) as {
            total_runs: number;
            completed_runs: number;
            failed_runs: number;
        } | null;

        const emailStats = await this.deps.db.get<{
            total_sends: number;
            opened: number;
            clicked: number;
        }>(
            `SELECT 
                COUNT(*) as total_sends,
                SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
                SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked
             FROM email_sends`,
            []
        ) as {
            total_sends: number;
            opened: number;
            clicked: number;
        } | null;

        const totalRuns = playbookStats?.total_runs || 0;
        const completedRuns = playbookStats?.completed_runs || 0;
        const totalSends = emailStats?.total_sends || 0;
        const opened = emailStats?.opened || 0;
        const clicked = emailStats?.clicked || 0;

        return {
            totalPlaybookTemplates: totals?.total_playbooks || 0,
            totalEmailTemplates: totals?.total_emails || 0,
            totalCategories: totals?.total_categories || 0,
            totalTags: totals?.total_tags || 0,
            publishedPlaybooks: totals?.published_playbooks || 0,
            publishedEmails: totals?.published_emails || 0,
            totalPlaybookRuns: totalRuns,
            totalEmailsSent: totalSends,
            avgPlaybookSuccessRate: totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0,
            avgEmailOpenRate: totalSends > 0 ? Math.round((opened / totalSends) * 100) : 0,
            avgEmailClickRate: totalSends > 0 ? Math.round((clicked / totalSends) * 100) : 0
        };
    }

    // ==========================================
    // GLOBAL SEARCH
    // ==========================================

    async searchContent(options: SearchContentOptions = {}): Promise<SearchResults> {
        const {
            query,
            contentTypes = [],
            statuses = [],
            categoryIds = [],
            tagIds = [],
            organizationId = null,
            sortBy = 'updatedAt',
            sortOrder = 'desc',
            page = 1,
            limit = 20
        } = options;

        const results: SearchResults = {
            items: [],
            total: 0,
            page,
            limit,
            hasMore: false
        };

        const offset = (page - 1) * limit;
        const searchTypes = contentTypes.length > 0 ? contentTypes : ['PLAYBOOK_TEMPLATE', 'EMAIL_TEMPLATE'];

        // Search playbook templates
        if (searchTypes.includes('PLAYBOOK_TEMPLATE')) {
            const conditions: string[] = ['1=1'];
            const params: unknown[] = [];

            if (query) {
                conditions.push('(title LIKE ? OR description LIKE ? OR key LIKE ?)');
                const searchTerm = `%${query}%`;
                params.push(searchTerm, searchTerm, searchTerm);
            }

            if (statuses.length > 0) {
                conditions.push(`status IN (${statuses.map(() => '?').join(',')})`);
                params.push(...statuses);
            }

            if (categoryIds.length > 0) {
                conditions.push(`category_id IN (${categoryIds.map(() => '?').join(',')})`);
                params.push(...categoryIds);
            }

            const playbooks = await this.deps.db.all<{
                id: string;
                key?: string;
                title: string;
                description?: string;
                status?: string;
                version?: number;
                category_id?: string | null;
                created_at?: string;
                updated_at?: string;
            }>(
                `SELECT *, 'PLAYBOOK_TEMPLATE' as content_type FROM ai_playbook_templates WHERE ${conditions.join(' AND ')}`,
                params
            ) as Array<{
                id: string;
                key?: string;
                title: string;
                description?: string;
                status?: string;
                version?: number;
                category_id?: string | null;
                created_at?: string;
                updated_at?: string;
            }>;

            results.items.push(...playbooks.map(row => ({
                id: row.id,
                contentType: 'PLAYBOOK_TEMPLATE',
                key: row.key,
                title: row.title,
                description: row.description,
                status: row.status,
                version: row.version,
                categoryId: row.category_id,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            })));
        }

        // Search email templates
        if (searchTypes.includes('EMAIL_TEMPLATE')) {
            const conditions: string[] = ['1=1'];
            const params: unknown[] = [];

            if (query) {
                conditions.push('(name LIKE ? OR description LIKE ? OR template_key LIKE ? OR subject LIKE ?)');
                const searchTerm = `%${query}%`;
                params.push(searchTerm, searchTerm, searchTerm, searchTerm);
            }

            if (statuses.length > 0) {
                conditions.push(`status IN (${statuses.map(() => '?').join(',')})`);
                params.push(...statuses);
            }

            if (categoryIds.length > 0) {
                conditions.push(`category_id IN (${categoryIds.map(() => '?').join(',')})`);
                params.push(...categoryIds);
            }

            const emails = await this.deps.db.all<{
                id: string;
                template_key?: string;
                name: string;
                description?: string;
                status?: string;
                version?: number;
                category_id?: string | null;
                created_at?: string;
                updated_at?: string;
            }>(
                `SELECT *, 'EMAIL_TEMPLATE' as content_type FROM email_templates WHERE ${conditions.join(' AND ')}`,
                params
            ) as Array<{
                id: string;
                template_key?: string;
                name: string;
                description?: string;
                status?: string;
                version?: number;
                category_id?: string | null;
                created_at?: string;
                updated_at?: string;
            }>;

            results.items.push(...emails.map(row => ({
                id: row.id,
                contentType: 'EMAIL_TEMPLATE',
                key: row.template_key,
                title: row.name,
                description: row.description,
                status: row.status,
                version: row.version,
                categoryId: row.category_id,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            })));
        }

        // Sort results
        const sortField = sortBy === 'name' || sortBy === 'title' ? 'title' : sortBy;
        results.items.sort((a, b) => {
            const aVal = a[sortField as keyof typeof a] || '';
            const bVal = b[sortField as keyof typeof b] || '';
            const cmp = String(aVal).localeCompare(String(bVal));
            return sortOrder === 'asc' ? cmp : -cmp;
        });

        // Paginate
        results.total = results.items.length;
        results.items = results.items.slice(offset, offset + limit);
        results.hasMore = offset + limit < results.total;

        return results;
    }

    // ==========================================
    // HELPERS
    // ==========================================

    private _mapCategoryRow(row: CategoryRecord): Category {
        return {
            id: row.id,
            name: row.name,
            slug: row.slug,
            description: row.description,
            contentType: row.content_type,
            parentId: row.parent_id || undefined,
            sortOrder: row.sort_order,
            color: row.color,
            icon: row.icon,
            organizationId: row.organization_id || undefined,
            isActive: !!row.is_active,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            createdBy: row.created_by || undefined
        };
    }

    private _mapTagRow(row: TagRecord): Tag {
        return {
            id: row.id,
            name: row.name,
            slug: row.slug,
            contentType: row.content_type,
            color: row.color,
            organizationId: row.organization_id || undefined,
            usageCount: row.usage_count || 0,
            isActive: !!row.is_active,
            createdAt: row.created_at,
            createdBy: row.created_by || undefined
        };
    }

    private _mapCommentRow(row: CommentRecord): Comment {
        return {
            id: row.id,
            contentId: row.content_id,
            contentType: row.content_type,
            userId: row.user_id,
            commentText: row.comment_text,
            parentCommentId: row.parent_comment_id || undefined,
            threadId: row.thread_id,
            positionRef: row.position_ref || undefined,
            isResolved: !!row.is_resolved,
            resolvedBy: row.resolved_by || undefined,
            resolvedAt: row.resolved_at || undefined,
            mentionedUserIds: row.mentioned_user_ids ? JSON.parse(row.mentioned_user_ids) as string[] : [],
            isEdited: !!row.is_edited,
            editedAt: row.edited_at || undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            user: row.first_name ? {
                id: row.user_id,
                firstName: row.first_name,
                lastName: row.last_name || '',
                avatar: row.avatar || undefined
            } : null
        };
    }

    private _mapReviewRow(row: ReviewRecord): Review {
        return {
            id: row.id,
            contentId: row.content_id,
            contentType: row.content_type,
            requestedBy: row.requested_by,
            requestedAt: row.requested_at,
            reviewerId: row.reviewer_id,
            status: row.status,
            reviewNotes: row.review_notes || undefined,
            checklistItems: row.checklist_items ? JSON.parse(row.checklist_items) as unknown[] : [],
            reviewedAt: row.reviewed_at || undefined,
            versionAtReview: row.version_at_review || undefined,
            priority: row.priority,
            dueDate: row.due_date || undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            requester: row.requester_first_name ? {
                id: row.requested_by,
                firstName: row.requester_first_name,
                lastName: row.requester_last_name || ''
            } : null,
            reviewer: row.reviewer_first_name ? {
                id: row.reviewer_id,
                firstName: row.reviewer_first_name,
                lastName: row.reviewer_last_name || ''
            } : null
        };
    }

    private _camelToSnake(str: string): string {
        return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    }
}

// Create singleton instance
const contentServiceInstance = new ContentServiceClass();

// Export individual functions for backward compatibility
export const createCategory = (data: CreateCategoryData) => contentServiceInstance.createCategory(data);
export const getCategoryById = (id: string) => contentServiceInstance.getCategoryById(id);
export const listCategories = (options?: ListCategoriesOptions) => contentServiceInstance.listCategories(options);
export const updateCategory = (id: string, updates: UpdateCategoryData) => contentServiceInstance.updateCategory(id, updates);
export const deleteCategory = (id: string) => contentServiceInstance.deleteCategory(id);
export const getCategoryTree = (options?: ListCategoriesOptions) => contentServiceInstance.getCategoryTree(options);
export const createTag = (data: CreateTagData) => contentServiceInstance.createTag(data);
export const getTagById = (id: string) => contentServiceInstance.getTagById(id);
export const listTags = (options?: ListTagsOptions) => contentServiceInstance.listTags(options);
export const updateTag = (id: string, updates: UpdateTagData) => contentServiceInstance.updateTag(id, updates);
export const deleteTag = (id: string) => contentServiceInstance.deleteTag(id);
export const getContentTags = (contentId: string, contentType: string) => contentServiceInstance.getContentTags(contentId, contentType);
export const addTagToContent = (contentId: string, contentType: string, tagId: string, userId?: string | null) => contentServiceInstance.addTagToContent(contentId, contentType, tagId, userId);
export const removeTagFromContent = (contentId: string, contentType: string, tagId: string) => contentServiceInstance.removeTagFromContent(contentId, contentType, tagId);
export const createComment = (data: CreateCommentData) => contentServiceInstance.createComment(data);
export const getCommentById = (id: string) => contentServiceInstance.getCommentById(id);
export const getContentComments = (contentId: string, contentType: string, options?: GetContentCommentsOptions) => contentServiceInstance.getContentComments(contentId, contentType, options);
export const updateComment = (id: string, commentText: string, userId: string) => contentServiceInstance.updateComment(id, commentText, userId);
export const resolveComment = (id: string, userId: string) => contentServiceInstance.resolveComment(id, userId);
export const deleteComment = (id: string) => contentServiceInstance.deleteComment(id);
export const createReview = (data: CreateReviewData) => contentServiceInstance.createReview(data);
export const getReviewById = (id: string) => contentServiceInstance.getReviewById(id);
export const getContentReviews = (contentId: string, contentType: string) => contentServiceInstance.getContentReviews(contentId, contentType);
export const getPendingReviews = (reviewerId: string) => contentServiceInstance.getPendingReviews(reviewerId);
export const updateReviewStatus = (id: string, status: string, reviewNotes?: string | null, checklistItems?: unknown[] | null) => contentServiceInstance.updateReviewStatus(id, status, reviewNotes, checklistItems);
export const approveReview = (reviewId: string, reviewNotes?: string | null) => contentServiceInstance.approveReview(reviewId, reviewNotes);
export const rejectReview = (reviewId: string, reviewNotes: string) => contentServiceInstance.rejectReview(reviewId, reviewNotes);
export const requestChanges = (reviewId: string, reviewNotes: string) => contentServiceInstance.requestChanges(reviewId, reviewNotes);
export const addFavorite = (userId: string, contentId: string, contentType: string, options?: AddFavoriteOptions) => contentServiceInstance.addFavorite(userId, contentId, contentType, options);
export const removeFavorite = (userId: string, contentId: string, contentType: string) => contentServiceInstance.removeFavorite(userId, contentId, contentType);
export const getUserFavorites = (userId: string, options?: GetUserFavoritesOptions) => contentServiceInstance.getUserFavorites(userId, options);
export const isFavorited = (userId: string, contentId: string, contentType: string) => contentServiceInstance.isFavorited(userId, contentId, contentType);
export const logAnalyticsEvent = (data: LogAnalyticsEventData) => contentServiceInstance.logAnalyticsEvent(data);
export const getContentAnalytics = (contentId: string, contentType: string, options?: GetContentAnalyticsOptions) => contentServiceInstance.getContentAnalytics(contentId, contentType, options);
export const getAnalyticsDashboard = (options?: { organizationId?: string | null; dateFrom?: string | null; dateTo?: string | null }) => contentServiceInstance.getAnalyticsDashboard(options);
export const searchContent = (options?: SearchContentOptions) => contentServiceInstance.searchContent(options);

// Default export for backward compatibility
const contentService = {
    CONTENT_TYPES,
    REVIEW_STATUSES,
    REVIEW_PRIORITIES,
    createCategory,
    getCategoryById,
    listCategories,
    updateCategory,
    deleteCategory,
    getCategoryTree,
    createTag,
    getTagById,
    listTags,
    updateTag,
    deleteTag,
    getContentTags,
    addTagToContent,
    removeTagFromContent,
    createComment,
    getCommentById,
    getContentComments,
    updateComment,
    resolveComment,
    deleteComment,
    createReview,
    getReviewById,
    getContentReviews,
    getPendingReviews,
    updateReviewStatus,
    approveReview,
    rejectReview,
    requestChanges,
    addFavorite,
    removeFavorite,
    getUserFavorites,
    isFavorited,
    logAnalyticsEvent,
    getContentAnalytics,
    getAnalyticsDashboard,
    searchContent
};

export default contentService;
