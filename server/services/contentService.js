/**
 * Content Service
 * Shared functionality for Content Module: categories, tags, comments, reviews,
 * analytics, favorites, and permissions.
 * 
 * Part of Content Module Enterprise Extension
 */

import { getDatabase } from '../src/database/Database.ts';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';



const CONTENT_TYPES = {
    PLAYBOOK_TEMPLATE: 'PLAYBOOK_TEMPLATE',
    EMAIL_TEMPLATE: 'EMAIL_TEMPLATE',
    CATEGORY: 'CATEGORY'
};

const REVIEW_STATUSES = {
    PENDING: 'PENDING',
    IN_REVIEW: 'IN_REVIEW',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    CHANGES_REQUESTED: 'CHANGES_REQUESTED'
};

const REVIEW_PRIORITIES = {
    LOW: 'LOW',
    NORMAL: 'NORMAL',
    HIGH: 'HIGH',
    URGENT: 'URGENT'
};

const ContentService = {
    CONTENT_TYPES,
    REVIEW_STATUSES,
    REVIEW_PRIORITIES,

    // ==========================================
    // CATEGORIES
    // ==========================================

    /**
     * Create a category
     * @param {Object} data - Category data
     * @returns {Promise<Object>} Created category
     */
    createCategory: async ({
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
    }) => {
        if (!name) {
            throw new Error('name is required');
        }

        const id = `cat-${uuidv4()}`;
        const categorySlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO content_categories (
                    id, name, slug, description, content_type, parent_id,
                    sort_order, color, icon, organization_id, is_active,
                    created_at, updated_at, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
                [
                    id, name, categorySlug, description, contentType, parentId,
                    sortOrder, color, icon, organizationId, now, now, createdBy
                ],
                function(err) {
                    if (err) {
                        if (err.message.includes('UNIQUE')) {
                            return reject(new Error(`Category with slug '${categorySlug}' already exists`));
                        }
                        return reject(err);
                    }
                    resolve({
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
                    });
                }
            );
        });
    },

    /**
     * Get category by ID
     * @param {string} id - Category ID
     * @returns {Promise<Object|null>} Category or null
     */
    getCategoryById: async (id) => {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM content_categories WHERE id = ?',
                [id],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return resolve(null);
                    resolve(ContentService._mapCategoryRow(row));
                }
            );
        });
    },

    /**
     * List categories
     * @param {Object} options - Filter options
     * @returns {Promise<Array>} List of categories
     */
    listCategories: async ({
        contentType = null,
        organizationId = null,
        parentId = undefined,
        includeInactive = false
    } = {}) => {
        const conditions = [];
        const params = [];

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

        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM content_categories ${whereClause} ORDER BY sort_order, name`,
                params,
                (err, rows) => {
                    if (err) return reject(err);
                    resolve((rows || []).map(ContentService._mapCategoryRow));
                }
            );
        });
    },

    /**
     * Update category
     * @param {string} id - Category ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated category
     */
    updateCategory: async (id, updates) => {
        const allowedFields = ['name', 'slug', 'description', 'contentType', 'parentId', 'sortOrder', 'color', 'icon', 'isActive'];
        const setClauses = [];
        const values = [];

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                const dbColumn = ContentService._camelToSnake(key);
                setClauses.push(`${dbColumn} = ?`);
                values.push(key === 'isActive' ? (value ? 1 : 0) : value);
            }
        }

        if (setClauses.length === 0) {
            return ContentService.getCategoryById(id);
        }

        setClauses.push('updated_at = ?');
        values.push(new Date().toISOString());
        values.push(id);

        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE content_categories SET ${setClauses.join(', ')} WHERE id = ?`,
                values,
                async function(err) {
                    if (err) return reject(err);
                    resolve(await ContentService.getCategoryById(id));
                }
            );
        });
    },

    /**
     * Delete category
     * @param {string} id - Category ID
     * @returns {Promise<boolean>} Success
     */
    deleteCategory: async (id) => {
        return new Promise((resolve, reject) => {
            db.run('DELETE FROM content_categories WHERE id = ?', [id], function(err) {
                if (err) return reject(err);
                resolve(this.changes > 0);
            });
        });
    },

    /**
     * Get categories as tree structure
     * @param {Object} options - Filter options
     * @returns {Promise<Array>} Tree of categories
     */
    getCategoryTree: async (options = {}) => {
        const categories = await ContentService.listCategories(options);
        
        const buildTree = (parentId = null) => {
            return categories
                .filter(cat => cat.parentId === parentId)
                .map(cat => ({
                    ...cat,
                    children: buildTree(cat.id)
                }));
        };

        return buildTree(null);
    },

    // ==========================================
    // TAGS
    // ==========================================

    /**
     * Create a tag
     * @param {Object} data - Tag data
     * @returns {Promise<Object>} Created tag
     */
    createTag: async ({
        name,
        slug = null,
        contentType = 'ALL',
        color = '#10B981',
        organizationId = null,
        createdBy = null
    }) => {
        if (!name) {
            throw new Error('name is required');
        }

        const id = `tag-${uuidv4()}`;
        const tagSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO content_tags (
                    id, name, slug, content_type, color, organization_id,
                    usage_count, is_active, created_at, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?)`,
                [id, name, tagSlug, contentType, color, organizationId, now, createdBy],
                function(err) {
                    if (err) {
                        if (err.message.includes('UNIQUE')) {
                            return reject(new Error(`Tag with slug '${tagSlug}' already exists`));
                        }
                        return reject(err);
                    }
                    resolve({
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
                    });
                }
            );
        });
    },

    /**
     * Get tag by ID
     * @param {string} id - Tag ID
     * @returns {Promise<Object|null>} Tag or null
     */
    getTagById: async (id) => {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM content_tags WHERE id = ?', [id], (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve(null);
                resolve(ContentService._mapTagRow(row));
            });
        });
    },

    /**
     * List tags
     * @param {Object} options - Filter options
     * @returns {Promise<Array>} List of tags
     */
    listTags: async ({
        contentType = null,
        organizationId = null,
        search = null,
        includeInactive = false,
        sortBy = 'name',
        limit = 100
    } = {}) => {
        const conditions = [];
        const params = [];

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

        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM content_tags ${whereClause} ORDER BY ${orderBy} DESC LIMIT ?`,
                [...params, limit],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve((rows || []).map(ContentService._mapTagRow));
                }
            );
        });
    },

    /**
     * Update tag
     * @param {string} id - Tag ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated tag
     */
    updateTag: async (id, updates) => {
        const allowedFields = ['name', 'slug', 'color', 'isActive'];
        const setClauses = [];
        const values = [];

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                const dbColumn = ContentService._camelToSnake(key);
                setClauses.push(`${dbColumn} = ?`);
                values.push(key === 'isActive' ? (value ? 1 : 0) : value);
            }
        }

        if (setClauses.length === 0) {
            return ContentService.getTagById(id);
        }

        values.push(id);

        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE content_tags SET ${setClauses.join(', ')} WHERE id = ?`,
                values,
                async function(err) {
                    if (err) return reject(err);
                    resolve(await ContentService.getTagById(id));
                }
            );
        });
    },

    /**
     * Delete tag
     * @param {string} id - Tag ID
     * @returns {Promise<boolean>} Success
     */
    deleteTag: async (id) => {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('DELETE FROM content_tag_mappings WHERE tag_id = ?', [id]);
                db.run('DELETE FROM content_tags WHERE id = ?', [id], function(err) {
                    if (err) return reject(err);
                    resolve(this.changes > 0);
                });
            });
        });
    },

    /**
     * Get tags for content
     * @param {string} contentId - Content ID
     * @param {string} contentType - Content type
     * @returns {Promise<Array>} List of tags
     */
    getContentTags: async (contentId, contentType) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT ct.* FROM content_tags ct
                 JOIN content_tag_mappings ctm ON ct.id = ctm.tag_id
                 WHERE ctm.content_id = ? AND ctm.content_type = ?`,
                [contentId, contentType],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve((rows || []).map(ContentService._mapTagRow));
                }
            );
        });
    },

    /**
     * Add tag to content
     * @param {string} contentId - Content ID
     * @param {string} contentType - Content type
     * @param {string} tagId - Tag ID
     * @param {string} userId - User adding tag
     * @returns {Promise<boolean>} Success
     */
    addTagToContent: async (contentId, contentType, tagId, userId = null) => {
        const id = `ctm-${uuidv4()}`;
        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT OR IGNORE INTO content_tag_mappings (id, content_id, content_type, tag_id, created_at, created_by)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [id, contentId, contentType, tagId, now, userId],
                function(err) {
                    if (err) return reject(err);
                    
                    if (this.changes > 0) {
                        db.run(
                            'UPDATE content_tags SET usage_count = usage_count + 1 WHERE id = ?',
                            [tagId],
                            () => resolve(true)
                        );
                    } else {
                        resolve(false);
                    }
                }
            );
        });
    },

    /**
     * Remove tag from content
     * @param {string} contentId - Content ID
     * @param {string} contentType - Content type
     * @param {string} tagId - Tag ID
     * @returns {Promise<boolean>} Success
     */
    removeTagFromContent: async (contentId, contentType, tagId) => {
        return new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM content_tag_mappings WHERE content_id = ? AND content_type = ? AND tag_id = ?`,
                [contentId, contentType, tagId],
                function(err) {
                    if (err) return reject(err);
                    
                    if (this.changes > 0) {
                        db.run(
                            'UPDATE content_tags SET usage_count = MAX(0, usage_count - 1) WHERE id = ?',
                            [tagId],
                            () => resolve(true)
                        );
                    } else {
                        resolve(false);
                    }
                }
            );
        });
    },

    // ==========================================
    // COMMENTS
    // ==========================================

    /**
     * Create a comment
     * @param {Object} data - Comment data
     * @returns {Promise<Object>} Created comment
     */
    createComment: async ({
        contentId,
        contentType,
        userId,
        commentText,
        parentCommentId = null,
        positionRef = null,
        mentionedUserIds = []
    }) => {
        if (!contentId || !contentType || !userId || !commentText) {
            throw new Error('contentId, contentType, userId, and commentText are required');
        }

        const id = `cmt-${uuidv4()}`;
        const now = new Date().toISOString();
        
        // Thread ID is the parent's thread ID or this comment's ID if it's a root comment
        let threadId = id;
        if (parentCommentId) {
            const parent = await ContentService.getCommentById(parentCommentId);
            threadId = parent?.threadId || parentCommentId;
        }

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO content_comments (
                    id, content_id, content_type, user_id, comment_text,
                    parent_comment_id, thread_id, position_ref, mentioned_user_ids,
                    is_resolved, is_edited, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
                [
                    id, contentId, contentType, userId, commentText,
                    parentCommentId, threadId, positionRef, JSON.stringify(mentionedUserIds),
                    now, now
                ],
                function(err) {
                    if (err) return reject(err);
                    resolve({
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
                    });
                }
            );
        });
    },

    /**
     * Get comment by ID
     * @param {string} id - Comment ID
     * @returns {Promise<Object|null>} Comment or null
     */
    getCommentById: async (id) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT cc.*, u.first_name, u.last_name, u.avatar
                 FROM content_comments cc
                 LEFT JOIN users u ON cc.user_id = u.id
                 WHERE cc.id = ?`,
                [id],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return resolve(null);
                    resolve(ContentService._mapCommentRow(row));
                }
            );
        });
    },

    /**
     * Get comments for content
     * @param {string} contentId - Content ID
     * @param {string} contentType - Content type
     * @param {Object} options - Filter options
     * @returns {Promise<Array>} List of comments (threaded)
     */
    getContentComments: async (contentId, contentType, { includeResolved = true } = {}) => {
        const conditions = ['cc.content_id = ?', 'cc.content_type = ?'];
        const params = [contentId, contentType];

        if (!includeResolved) {
            conditions.push('cc.is_resolved = 0');
        }

        return new Promise((resolve, reject) => {
            db.all(
                `SELECT cc.*, u.first_name, u.last_name, u.avatar
                 FROM content_comments cc
                 LEFT JOIN users u ON cc.user_id = u.id
                 WHERE ${conditions.join(' AND ')}
                 ORDER BY cc.created_at ASC`,
                params,
                (err, rows) => {
                    if (err) return reject(err);

                    const comments = (rows || []).map(ContentService._mapCommentRow);
                    
                    // Build threaded structure
                    const rootComments = comments.filter(c => !c.parentCommentId);
                    const getReplies = (parentId) => {
                        return comments
                            .filter(c => c.parentCommentId === parentId)
                            .map(c => ({
                                ...c,
                                replies: getReplies(c.id)
                            }));
                    };

                    const threaded = rootComments.map(c => ({
                        ...c,
                        replies: getReplies(c.id)
                    }));

                    resolve(threaded);
                }
            );
        });
    },

    /**
     * Update comment
     * @param {string} id - Comment ID
     * @param {string} commentText - New text
     * @param {string} userId - User making edit
     * @returns {Promise<Object>} Updated comment
     */
    updateComment: async (id, commentText, userId) => {
        const comment = await ContentService.getCommentById(id);
        
        if (!comment) {
            throw new Error(`Comment ${id} not found`);
        }

        if (comment.userId !== userId) {
            throw new Error('Can only edit your own comments');
        }

        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE content_comments SET comment_text = ?, is_edited = 1, edited_at = ?, updated_at = ? WHERE id = ?`,
                [commentText, now, now, id],
                async function(err) {
                    if (err) return reject(err);
                    resolve(await ContentService.getCommentById(id));
                }
            );
        });
    },

    /**
     * Resolve comment
     * @param {string} id - Comment ID
     * @param {string} userId - User resolving
     * @returns {Promise<Object>} Updated comment
     */
    resolveComment: async (id, userId) => {
        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE content_comments SET is_resolved = 1, resolved_by = ?, resolved_at = ?, updated_at = ? WHERE id = ?`,
                [userId, now, now, id],
                async function(err) {
                    if (err) return reject(err);
                    resolve(await ContentService.getCommentById(id));
                }
            );
        });
    },

    /**
     * Delete comment
     * @param {string} id - Comment ID
     * @returns {Promise<boolean>} Success
     */
    deleteComment: async (id) => {
        return new Promise((resolve, reject) => {
            db.run('DELETE FROM content_comments WHERE id = ?', [id], function(err) {
                if (err) return reject(err);
                resolve(this.changes > 0);
            });
        });
    },

    // ==========================================
    // REVIEWS
    // ==========================================

    /**
     * Create a review request
     * @param {Object} data - Review data
     * @returns {Promise<Object>} Created review
     */
    createReview: async ({
        contentId,
        contentType,
        requestedBy,
        reviewerId,
        priority = 'NORMAL',
        dueDate = null,
        checklistItems = [],
        versionAtReview = null
    }) => {
        if (!contentId || !contentType || !requestedBy || !reviewerId) {
            throw new Error('contentId, contentType, requestedBy, and reviewerId are required');
        }

        const id = `rev-${uuidv4()}`;
        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO content_reviews (
                    id, content_id, content_type, requested_by, requested_at,
                    reviewer_id, status, checklist_items, version_at_review,
                    priority, due_date, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?)`,
                [
                    id, contentId, contentType, requestedBy, now,
                    reviewerId, JSON.stringify(checklistItems), versionAtReview,
                    priority, dueDate, now, now
                ],
                function(err) {
                    if (err) return reject(err);
                    resolve({
                        id,
                        contentId,
                        contentType,
                        requestedBy,
                        requestedAt: now,
                        reviewerId,
                        status: REVIEW_STATUSES.PENDING,
                        reviewNotes: null,
                        checklistItems,
                        reviewedAt: null,
                        versionAtReview,
                        priority,
                        dueDate,
                        createdAt: now,
                        updatedAt: now
                    });
                }
            );
        });
    },

    /**
     * Get review by ID
     * @param {string} id - Review ID
     * @returns {Promise<Object|null>} Review or null
     */
    getReviewById: async (id) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT cr.*,
                    req.first_name as requester_first_name, req.last_name as requester_last_name,
                    rev.first_name as reviewer_first_name, rev.last_name as reviewer_last_name
                 FROM content_reviews cr
                 LEFT JOIN users req ON cr.requested_by = req.id
                 LEFT JOIN users rev ON cr.reviewer_id = rev.id
                 WHERE cr.id = ?`,
                [id],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return resolve(null);
                    resolve(ContentService._mapReviewRow(row));
                }
            );
        });
    },

    /**
     * Get reviews for content
     * @param {string} contentId - Content ID
     * @param {string} contentType - Content type
     * @returns {Promise<Array>} List of reviews
     */
    getContentReviews: async (contentId, contentType) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT cr.*,
                    req.first_name as requester_first_name, req.last_name as requester_last_name,
                    rev.first_name as reviewer_first_name, rev.last_name as reviewer_last_name
                 FROM content_reviews cr
                 LEFT JOIN users req ON cr.requested_by = req.id
                 LEFT JOIN users rev ON cr.reviewer_id = rev.id
                 WHERE cr.content_id = ? AND cr.content_type = ?
                 ORDER BY cr.created_at DESC`,
                [contentId, contentType],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve((rows || []).map(ContentService._mapReviewRow));
                }
            );
        });
    },

    /**
     * Get pending reviews for a user
     * @param {string} reviewerId - Reviewer user ID
     * @returns {Promise<Array>} List of reviews
     */
    getPendingReviews: async (reviewerId) => {
        return new Promise((resolve, reject) => {
            db.all(
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
                [reviewerId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve((rows || []).map(ContentService._mapReviewRow));
                }
            );
        });
    },

    /**
     * Update review status
     * @param {string} id - Review ID
     * @param {string} status - New status
     * @param {string} reviewNotes - Optional notes
     * @param {Array} checklistItems - Updated checklist
     * @returns {Promise<Object>} Updated review
     */
    updateReviewStatus: async (id, status, reviewNotes = null, checklistItems = null) => {
        const now = new Date().toISOString();
        const setClauses = ['status = ?', 'updated_at = ?'];
        const values = [status, now];

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

        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE content_reviews SET ${setClauses.join(', ')} WHERE id = ?`,
                values,
                async function(err) {
                    if (err) return reject(err);
                    resolve(await ContentService.getReviewById(id));
                }
            );
        });
    },

    /**
     * Approve content
     * @param {string} reviewId - Review ID
     * @param {string} reviewNotes - Optional notes
     * @returns {Promise<Object>} Updated review
     */
    approveReview: async (reviewId, reviewNotes = null) => {
        return ContentService.updateReviewStatus(reviewId, REVIEW_STATUSES.APPROVED, reviewNotes);
    },

    /**
     * Reject content
     * @param {string} reviewId - Review ID
     * @param {string} reviewNotes - Rejection reason
     * @returns {Promise<Object>} Updated review
     */
    rejectReview: async (reviewId, reviewNotes) => {
        return ContentService.updateReviewStatus(reviewId, REVIEW_STATUSES.REJECTED, reviewNotes);
    },

    /**
     * Request changes
     * @param {string} reviewId - Review ID
     * @param {string} reviewNotes - Requested changes
     * @returns {Promise<Object>} Updated review
     */
    requestChanges: async (reviewId, reviewNotes) => {
        return ContentService.updateReviewStatus(reviewId, REVIEW_STATUSES.CHANGES_REQUESTED, reviewNotes);
    },

    // ==========================================
    // FAVORITES
    // ==========================================

    /**
     * Add to favorites
     * @param {string} userId - User ID
     * @param {string} contentId - Content ID
     * @param {string} contentType - Content type
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Created favorite
     */
    addFavorite: async (userId, contentId, contentType, { notes = null, folderName = 'Default' } = {}) => {
        const id = `fav-${uuidv4()}`;
        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT OR IGNORE INTO content_favorites (id, user_id, content_id, content_type, notes, folder_name, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [id, userId, contentId, contentType, notes, folderName, now],
                function(err) {
                    if (err) return reject(err);
                    resolve({
                        id,
                        userId,
                        contentId,
                        contentType,
                        notes,
                        folderName,
                        createdAt: now
                    });
                }
            );
        });
    },

    /**
     * Remove from favorites
     * @param {string} userId - User ID
     * @param {string} contentId - Content ID
     * @param {string} contentType - Content type
     * @returns {Promise<boolean>} Success
     */
    removeFavorite: async (userId, contentId, contentType) => {
        return new Promise((resolve, reject) => {
            db.run(
                'DELETE FROM content_favorites WHERE user_id = ? AND content_id = ? AND content_type = ?',
                [userId, contentId, contentType],
                function(err) {
                    if (err) return reject(err);
                    resolve(this.changes > 0);
                }
            );
        });
    },

    /**
     * Get user favorites
     * @param {string} userId - User ID
     * @param {Object} options - Filter options
     * @returns {Promise<Array>} List of favorites
     */
    getUserFavorites: async (userId, { contentType = null, folderName = null } = {}) => {
        const conditions = ['user_id = ?'];
        const params = [userId];

        if (contentType) {
            conditions.push('content_type = ?');
            params.push(contentType);
        }

        if (folderName) {
            conditions.push('folder_name = ?');
            params.push(folderName);
        }

        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM content_favorites WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
                params,
                (err, rows) => {
                    if (err) return reject(err);
                    resolve((rows || []).map(row => ({
                        id: row.id,
                        userId: row.user_id,
                        contentId: row.content_id,
                        contentType: row.content_type,
                        notes: row.notes,
                        folderName: row.folder_name,
                        createdAt: row.created_at
                    })));
                }
            );
        });
    },

    /**
     * Check if content is favorited
     * @param {string} userId - User ID
     * @param {string} contentId - Content ID
     * @param {string} contentType - Content type
     * @returns {Promise<boolean>} Is favorited
     */
    isFavorited: async (userId, contentId, contentType) => {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT 1 FROM content_favorites WHERE user_id = ? AND content_id = ? AND content_type = ?',
                [userId, contentId, contentType],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(!!row);
                }
            );
        });
    },

    // ==========================================
    // ANALYTICS
    // ==========================================

    /**
     * Log analytics event
     * @param {Object} data - Event data
     * @returns {Promise<Object>} Created event
     */
    logAnalyticsEvent: async ({
        contentId,
        contentType,
        eventType,
        userId = null,
        organizationId = null,
        metadata = {},
        sessionId = null,
        durationMs = null
    }) => {
        const id = `ca-${uuidv4()}`;
        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO content_analytics (
                    id, content_id, content_type, event_type, user_id, organization_id,
                    metadata, session_id, duration_ms, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, contentId, contentType, eventType, userId, organizationId, JSON.stringify(metadata), sessionId, durationMs, now],
                function(err) {
                    if (err) return reject(err);
                    resolve({
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
                    });
                }
            );
        });
    },

    /**
     * Get analytics for content
     * @param {string} contentId - Content ID
     * @param {string} contentType - Content type
     * @param {Object} options - Filter options
     * @returns {Promise<Object>} Analytics data
     */
    getContentAnalytics: async (contentId, contentType, { dateFrom = null, dateTo = null } = {}) => {
        const conditions = ['content_id = ?', 'content_type = ?'];
        const params = [contentId, contentType];

        if (dateFrom) {
            conditions.push('created_at >= ?');
            params.push(dateFrom);
        }

        if (dateTo) {
            conditions.push('created_at <= ?');
            params.push(dateTo);
        }

        return new Promise((resolve, reject) => {
            db.get(
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
                params,
                (err, stats) => {
                    if (err) return reject(err);
                    resolve({
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
                    });
                }
            );
        });
    },

    /**
     * Get analytics dashboard data
     * @param {Object} options - Filter options
     * @returns {Promise<Object>} Dashboard data
     */
    getAnalyticsDashboard: async ({ organizationId = null, dateFrom = null, dateTo = null } = {}) => {
        // Get totals
        const totals = await new Promise((resolve, reject) => {
            db.get(
                `SELECT 
                    (SELECT COUNT(*) FROM ai_playbook_templates WHERE status = 'PUBLISHED') as published_playbooks,
                    (SELECT COUNT(*) FROM ai_playbook_templates) as total_playbooks,
                    (SELECT COUNT(*) FROM email_templates WHERE status = 'PUBLISHED') as published_emails,
                    (SELECT COUNT(*) FROM email_templates) as total_emails,
                    (SELECT COUNT(*) FROM content_categories WHERE is_active = 1) as total_categories,
                    (SELECT COUNT(*) FROM content_tags WHERE is_active = 1) as total_tags`,
                [],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row || {});
                }
            );
        });

        // Get playbook runs stats
        const playbookStats = await new Promise((resolve, reject) => {
            db.get(
                `SELECT 
                    COUNT(*) as total_runs,
                    SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_runs,
                    SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_runs
                 FROM ai_playbook_runs`,
                [],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row || {});
                }
            );
        });

        // Get email sends stats
        const emailStats = await new Promise((resolve, reject) => {
            db.get(
                `SELECT 
                    COUNT(*) as total_sends,
                    SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
                    SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked
                 FROM email_sends`,
                [],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row || {});
                }
            );
        });

        const totalRuns = playbookStats.total_runs || 0;
        const completedRuns = playbookStats.completed_runs || 0;
        const totalSends = emailStats.total_sends || 0;
        const opened = emailStats.opened || 0;
        const clicked = emailStats.clicked || 0;

        return {
            totalPlaybookTemplates: totals.total_playbooks || 0,
            totalEmailTemplates: totals.total_emails || 0,
            totalCategories: totals.total_categories || 0,
            totalTags: totals.total_tags || 0,
            publishedPlaybooks: totals.published_playbooks || 0,
            publishedEmails: totals.published_emails || 0,
            totalPlaybookRuns: totalRuns,
            totalEmailsSent: totalSends,
            avgPlaybookSuccessRate: totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0,
            avgEmailOpenRate: totalSends > 0 ? Math.round((opened / totalSends) * 100) : 0,
            avgEmailClickRate: totalSends > 0 ? Math.round((clicked / totalSends) * 100) : 0
        };
    },

    // ==========================================
    // GLOBAL SEARCH
    // ==========================================

    /**
     * Search content globally
     * @param {Object} options - Search options
     * @returns {Promise<Object>} Search results
     */
    searchContent: async ({
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
    }) => {
        const results = {
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
            const playbooks = await new Promise((resolve, reject) => {
                const conditions = ['1=1'];
                const params = [];

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

                db.all(
                    `SELECT *, 'PLAYBOOK_TEMPLATE' as content_type FROM ai_playbook_templates WHERE ${conditions.join(' AND ')}`,
                    params,
                    (err, rows) => {
                        if (err) return reject(err);
                        resolve(rows || []);
                    }
                );
            });

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
            const emails = await new Promise((resolve, reject) => {
                const conditions = ['1=1'];
                const params = [];

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

                db.all(
                    `SELECT *, 'EMAIL_TEMPLATE' as content_type FROM email_templates WHERE ${conditions.join(' AND ')}`,
                    params,
                    (err, rows) => {
                        if (err) return reject(err);
                        resolve(rows || []);
                    }
                );
            });

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
            const aVal = a[sortField] || '';
            const bVal = b[sortField] || '';
            const cmp = String(aVal).localeCompare(String(bVal));
            return sortOrder === 'asc' ? cmp : -cmp;
        });

        // Paginate
        results.total = results.items.length;
        results.items = results.items.slice(offset, offset + limit);
        results.hasMore = offset + limit < results.total;

        return results;
    },

    // ==========================================
    // HELPERS
    // ==========================================

    _mapCategoryRow: (row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        contentType: row.content_type,
        parentId: row.parent_id,
        sortOrder: row.sort_order,
        color: row.color,
        icon: row.icon,
        organizationId: row.organization_id,
        isActive: !!row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by
    }),

    _mapTagRow: (row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        contentType: row.content_type,
        color: row.color,
        organizationId: row.organization_id,
        usageCount: row.usage_count || 0,
        isActive: !!row.is_active,
        createdAt: row.created_at,
        createdBy: row.created_by
    }),

    _mapCommentRow: (row) => ({
        id: row.id,
        contentId: row.content_id,
        contentType: row.content_type,
        userId: row.user_id,
        commentText: row.comment_text,
        parentCommentId: row.parent_comment_id,
        threadId: row.thread_id,
        positionRef: row.position_ref,
        isResolved: !!row.is_resolved,
        resolvedBy: row.resolved_by,
        resolvedAt: row.resolved_at,
        mentionedUserIds: row.mentioned_user_ids ? JSON.parse(row.mentioned_user_ids) : [],
        isEdited: !!row.is_edited,
        editedAt: row.edited_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        user: row.first_name ? {
            id: row.user_id,
            firstName: row.first_name,
            lastName: row.last_name,
            avatar: row.avatar
        } : null
    }),

    _mapReviewRow: (row) => ({
        id: row.id,
        contentId: row.content_id,
        contentType: row.content_type,
        requestedBy: row.requested_by,
        requestedAt: row.requested_at,
        reviewerId: row.reviewer_id,
        status: row.status,
        reviewNotes: row.review_notes,
        checklistItems: row.checklist_items ? JSON.parse(row.checklist_items) : [],
        reviewedAt: row.reviewed_at,
        versionAtReview: row.version_at_review,
        priority: row.priority,
        dueDate: row.due_date,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        requester: row.requester_first_name ? {
            id: row.requested_by,
            firstName: row.requester_first_name,
            lastName: row.requester_last_name
        } : null,
        reviewer: row.reviewer_first_name ? {
            id: row.reviewer_id,
            firstName: row.reviewer_first_name,
            lastName: row.reviewer_last_name
        } : null
    }),

    _camelToSnake: (str) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
};

export default ContentService;









