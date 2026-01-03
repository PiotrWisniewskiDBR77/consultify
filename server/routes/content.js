/**
 * Content Module API Routes
 * Enterprise-level content management for Email Templates and Playbook Templates
 * 
 * Base path: /api/content
 */

import express from 'express';
const router = express.Router();
import authMiddleware from '../middleware/authMiddleware.js';
const EmailTemplateService = import('emailTemplateService.js');
const ContentService = import('contentService.js');
const AIPlaybookService = require('../ai/aiPlaybookService');

// ==========================================
// MIDDLEWARE HELPERS
// ==========================================

/**
 * Verify admin access (ADMIN or SUPERADMIN)
 */
const verifyAdmin = (req, res, next) => {
    const role = req.user?.role;
    if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

/**
 * Verify superadmin access
 */
const verifySuperAdmin = (req, res, next) => {
    if (req.user?.role !== 'SUPERADMIN') {
        return res.status(403).json({ error: 'SuperAdmin access required' });
    }
    next();
};

/**
 * Error handler wrapper
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// ==========================================
// EMAIL TEMPLATES
// ==========================================

/**
 * GET /api/content/emails/templates
 * List email templates with filters
 */
router.get('/emails/templates', authMiddleware, asyncHandler(async (req, res) => {
    const {
        status,
        categoryId,
        languageCode,
        search,
        includeInactive,
        sortBy,
        sortOrder,
        limit,
        offset
    } = req.query;

    const templates = await EmailTemplateService.listTemplates({
        organizationId: req.user.organizationId,
        status,
        categoryId,
        languageCode,
        search,
        includeInactive: includeInactive === 'true',
        sortBy,
        sortOrder,
        limit: limit ? parseInt(limit) : 50,
        offset: offset ? parseInt(offset) : 0
    });

    res.json({ templates });
}));

/**
 * POST /api/content/emails/templates
 * Create a new email template
 */
router.post('/emails/templates', authMiddleware, verifyAdmin, asyncHandler(async (req, res) => {
    const {
        templateKey,
        name,
        description,
        subject,
        htmlContent,
        textContent,
        availableVariables,
        variablesSchema,
        categoryId,
        languageCode
    } = req.body;

    const template = await EmailTemplateService.createTemplate({
        organizationId: req.user.role === 'SUPERADMIN' ? null : req.user.organizationId,
        templateKey,
        name,
        description,
        subject,
        htmlContent,
        textContent,
        availableVariables,
        variablesSchema,
        categoryId,
        languageCode,
        createdBy: req.user.id
    });

    res.status(201).json({ template });
}));

/**
 * GET /api/content/emails/templates/:id
 * Get email template by ID
 */
router.get('/emails/templates/:id', authMiddleware, asyncHandler(async (req, res) => {
    const template = await EmailTemplateService.getTemplateById(req.params.id);
    
    if (!template) {
        return res.status(404).json({ error: 'Template not found' });
    }

    // Log view analytics
    await EmailTemplateService.logAnalyticsEvent({
        contentId: template.id,
        eventType: 'VIEW',
        userId: req.user.id,
        organizationId: req.user.organizationId
    });

    res.json({ template });
}));

/**
 * PUT /api/content/emails/templates/:id
 * Update email template
 */
router.put('/emails/templates/:id', authMiddleware, verifyAdmin, asyncHandler(async (req, res) => {
    const template = await EmailTemplateService.updateTemplate(
        req.params.id,
        req.body,
        req.user.id
    );

    res.json({ template });
}));

/**
 * DELETE /api/content/emails/templates/:id
 * Delete email template (soft delete)
 */
router.delete('/emails/templates/:id', authMiddleware, verifySuperAdmin, asyncHandler(async (req, res) => {
    const success = await EmailTemplateService.deleteTemplate(req.params.id);
    res.json({ success });
}));

/**
 * POST /api/content/emails/templates/:id/publish
 * Publish email template
 */
router.post('/emails/templates/:id/publish', authMiddleware, verifyAdmin, asyncHandler(async (req, res) => {
    const template = await EmailTemplateService.publishTemplate(req.params.id, req.user.id);
    res.json({ template });
}));

/**
 * POST /api/content/emails/templates/:id/deprecate
 * Deprecate email template
 */
router.post('/emails/templates/:id/deprecate', authMiddleware, verifyAdmin, asyncHandler(async (req, res) => {
    const template = await EmailTemplateService.deprecateTemplate(req.params.id, req.user.id);
    res.json({ template });
}));

/**
 * POST /api/content/emails/templates/:id/clone
 * Clone email template
 */
router.post('/emails/templates/:id/clone', authMiddleware, verifyAdmin, asyncHandler(async (req, res) => {
    const { templateKey, name, description, categoryId, languageCode } = req.body;
    
    const template = await EmailTemplateService.cloneTemplate(
        req.params.id,
        { templateKey, name, description, categoryId, languageCode },
        req.user.id
    );

    res.status(201).json({ template });
}));

/**
 * GET /api/content/emails/templates/:id/preview
 * Preview email template with test data
 */
router.get('/emails/templates/:id/preview', authMiddleware, asyncHandler(async (req, res) => {
    const testData = req.query.testData ? JSON.parse(req.query.testData) : {};
    const preview = await EmailTemplateService.previewTemplate(req.params.id, testData);

    // Log preview analytics
    await EmailTemplateService.logAnalyticsEvent({
        contentId: req.params.id,
        eventType: 'PREVIEW',
        userId: req.user.id,
        organizationId: req.user.organizationId
    });

    res.json(preview);
}));

/**
 * POST /api/content/emails/templates/:id/preview
 * Preview email template with test data (POST version for larger payloads)
 */
router.post('/emails/templates/:id/preview', authMiddleware, asyncHandler(async (req, res) => {
    const { testData } = req.body;
    const preview = await EmailTemplateService.previewTemplate(req.params.id, testData || {});

    await EmailTemplateService.logAnalyticsEvent({
        contentId: req.params.id,
        eventType: 'PREVIEW',
        userId: req.user.id,
        organizationId: req.user.organizationId
    });

    res.json(preview);
}));

/**
 * POST /api/content/emails/templates/:id/test-send
 * Send test email
 */
router.post('/emails/templates/:id/test-send', authMiddleware, verifyAdmin, asyncHandler(async (req, res) => {
    const { recipientEmails, testData } = req.body;

    if (!recipientEmails || recipientEmails.length === 0) {
        return res.status(400).json({ error: 'At least one recipient email is required' });
    }

    const result = await EmailTemplateService.sendTestEmail(
        req.params.id,
        recipientEmails,
        testData || {},
        req.user.id
    );

    res.json(result);
}));

/**
 * GET /api/content/emails/templates/:id/versions
 * Get version history
 */
router.get('/emails/templates/:id/versions', authMiddleware, asyncHandler(async (req, res) => {
    const versions = await EmailTemplateService.getVersionHistory(req.params.id);
    res.json({ versions });
}));

/**
 * POST /api/content/emails/templates/:id/versions/:version/restore
 * Restore to a previous version
 */
router.post('/emails/templates/:id/versions/:version/restore', authMiddleware, verifyAdmin, asyncHandler(async (req, res) => {
    const template = await EmailTemplateService.restoreVersion(
        req.params.id,
        parseInt(req.params.version),
        req.user.id
    );

    res.json({ template });
}));

/**
 * GET /api/content/emails/templates/:id/analytics
 * Get template analytics
 */
router.get('/emails/templates/:id/analytics', authMiddleware, verifyAdmin, asyncHandler(async (req, res) => {
    const { dateFrom, dateTo, eventType, limit } = req.query;

    const [stats, events] = await Promise.all([
        EmailTemplateService.getTemplateStats(req.params.id),
        EmailTemplateService.getTemplateAnalytics(req.params.id, {
            dateFrom,
            dateTo,
            eventType,
            limit: limit ? parseInt(limit) : 100
        })
    ]);

    res.json({ stats, events });
}));

/**
 * GET /api/content/emails/templates/:id/sends
 * Get email sends for a template
 */
router.get('/emails/templates/:id/sends', authMiddleware, verifyAdmin, asyncHandler(async (req, res) => {
    const { status, limit, offset } = req.query;

    const sends = await EmailTemplateService.getTemplateSends(req.params.id, {
        status,
        limit: limit ? parseInt(limit) : 100,
        offset: offset ? parseInt(offset) : 0
    });

    res.json({ sends });
}));

/**
 * POST /api/content/emails/templates/:id/tags
 * Add tag to template
 */
router.post('/emails/templates/:id/tags', authMiddleware, verifyAdmin, asyncHandler(async (req, res) => {
    const { tagId } = req.body;
    const success = await EmailTemplateService.addTag(req.params.id, tagId, req.user.id);
    res.json({ success });
}));

/**
 * DELETE /api/content/emails/templates/:id/tags/:tagId
 * Remove tag from template
 */
router.delete('/emails/templates/:id/tags/:tagId', authMiddleware, verifyAdmin, asyncHandler(async (req, res) => {
    const success = await EmailTemplateService.removeTag(req.params.id, req.params.tagId);
    res.json({ success });
}));

// ==========================================
// PLAYBOOK TEMPLATES EXTENSIONS
// ==========================================

/**
 * GET /api/content/playbooks/templates/:id/versions
 * Get version history for playbook template
 */
router.get('/playbooks/templates/:id/versions', authMiddleware, asyncHandler(async (req, res) => {
    const versions = await AIPlaybookService.getTemplateVersionHistory(req.params.id);
    res.json({ versions });
}));

/**
 * POST /api/content/playbooks/templates/:id/versions/:version/restore
 * Restore playbook template to a previous version
 */
router.post('/playbooks/templates/:id/versions/:version/restore', authMiddleware, verifyAdmin, asyncHandler(async (req, res) => {
    const template = await AIPlaybookService.restoreTemplateVersion(
        req.params.id,
        parseInt(req.params.version),
        req.user.id
    );

    res.json({ template });
}));

/**
 * POST /api/content/playbooks/templates/:id/clone
 * Clone playbook template
 */
router.post('/playbooks/templates/:id/clone', authMiddleware, verifyAdmin, asyncHandler(async (req, res) => {
    const { key, title, description } = req.body;
    
    const template = await AIPlaybookService.cloneTemplate(
        req.params.id,
        { key, title, description },
        req.user.id
    );

    res.status(201).json({ template });
}));

/**
 * GET /api/content/playbooks/templates/:id/analytics
 * Get playbook template analytics
 */
router.get('/playbooks/templates/:id/analytics', authMiddleware, verifyAdmin, asyncHandler(async (req, res) => {
    const { dateFrom, dateTo, eventType, limit } = req.query;

    const [stats, events] = await Promise.all([
        AIPlaybookService.getTemplateStats(req.params.id),
        AIPlaybookService.getTemplateAnalytics(req.params.id, {
            dateFrom,
            dateTo,
            eventType,
            limit: limit ? parseInt(limit) : 100
        })
    ]);

    res.json({ stats, events });
}));

/**
 * GET /api/content/playbooks/templates/search
 * Search playbook templates
 */
router.get('/playbooks/templates/search', authMiddleware, asyncHandler(async (req, res) => {
    const {
        query,
        status,
        categoryId,
        triggerSignal,
        sortBy,
        sortOrder,
        limit,
        offset
    } = req.query;

    const templates = await AIPlaybookService.searchTemplates({
        query,
        status,
        categoryId,
        triggerSignal,
        organizationId: req.user.organizationId,
        sortBy,
        sortOrder,
        limit: limit ? parseInt(limit) : 50,
        offset: offset ? parseInt(offset) : 0
    });

    res.json({ templates });
}));

/**
 * POST /api/content/playbooks/templates/bulk-action
 * Bulk update playbook templates
 */
router.post('/playbooks/templates/bulk-action', authMiddleware, verifyAdmin, asyncHandler(async (req, res) => {
    const { templateIds, action, payload } = req.body;

    if (!templateIds || templateIds.length === 0) {
        return res.status(400).json({ error: 'templateIds required' });
    }

    let updates = {};
    switch (action) {
        case 'PUBLISH':
            updates = { status: 'PUBLISHED' };
            break;
        case 'DEPRECATE':
            updates = { status: 'DEPRECATED' };
            break;
        case 'CHANGE_CATEGORY':
            updates = { categoryId: payload?.categoryId };
            break;
        case 'DELETE':
            updates = { isActive: false };
            break;
        default:
            return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    const result = await AIPlaybookService.bulkUpdateTemplates(templateIds, updates, req.user.id);

    res.json({
        success: result.failed.length === 0,
        processed: result.success.length,
        failed: result.failed.length,
        errors: result.failed
    });
}));

/**
 * GET /api/content/playbooks/templates/:id/comments
 * Get comments for playbook template
 */
router.get('/playbooks/templates/:id/comments', authMiddleware, asyncHandler(async (req, res) => {
    const { includeResolved } = req.query;
    const comments = await ContentService.getContentComments(
        req.params.id,
        'PLAYBOOK_TEMPLATE',
        { includeResolved: includeResolved !== 'false' }
    );
    res.json({ comments });
}));

/**
 * POST /api/content/playbooks/templates/:id/comments
 * Add comment to playbook template
 */
router.post('/playbooks/templates/:id/comments', authMiddleware, asyncHandler(async (req, res) => {
    const { commentText, parentCommentId, positionRef, mentionedUserIds } = req.body;

    const comment = await ContentService.createComment({
        contentId: req.params.id,
        contentType: 'PLAYBOOK_TEMPLATE',
        userId: req.user.id,
        commentText,
        parentCommentId,
        positionRef,
        mentionedUserIds
    });

    res.status(201).json({ comment });
}));

/**
 * GET /api/content/playbooks/templates/:id/reviews
 * Get reviews for playbook template
 */
router.get('/playbooks/templates/:id/reviews', authMiddleware, asyncHandler(async (req, res) => {
    const reviews = await ContentService.getContentReviews(req.params.id, 'PLAYBOOK_TEMPLATE');
    res.json({ reviews });
}));

/**
 * POST /api/content/playbooks/templates/:id/reviews
 * Create review request for playbook template
 */
router.post('/playbooks/templates/:id/reviews', authMiddleware, asyncHandler(async (req, res) => {
    const { reviewerId, priority, dueDate, checklistItems } = req.body;

    // Get current template version
    const template = await AIPlaybookService.getTemplateById(req.params.id);
    if (!template) {
        return res.status(404).json({ error: 'Template not found' });
    }

    const review = await ContentService.createReview({
        contentId: req.params.id,
        contentType: 'PLAYBOOK_TEMPLATE',
        requestedBy: req.user.id,
        reviewerId,
        priority,
        dueDate,
        checklistItems,
        versionAtReview: template.version
    });

    res.status(201).json({ review });
}));

/**
 * POST /api/content/playbooks/templates/:id/approve
 * Approve playbook template review
 */
router.post('/playbooks/templates/:id/approve', authMiddleware, verifyAdmin, asyncHandler(async (req, res) => {
    const { reviewId, reviewNotes } = req.body;
    const review = await ContentService.approveReview(reviewId, reviewNotes);
    res.json({ review });
}));

/**
 * POST /api/content/playbooks/templates/:id/reject
 * Reject playbook template review
 */
router.post('/playbooks/templates/:id/reject', authMiddleware, verifyAdmin, asyncHandler(async (req, res) => {
    const { reviewId, reviewNotes } = req.body;
    const review = await ContentService.rejectReview(reviewId, reviewNotes);
    res.json({ review });
}));

/**
 * POST /api/content/playbooks/templates/:id/tags
 * Add tag to playbook template
 */
router.post('/playbooks/templates/:id/tags', authMiddleware, verifyAdmin, asyncHandler(async (req, res) => {
    const { tagId } = req.body;
    const success = await AIPlaybookService.addTemplateTag(req.params.id, tagId, req.user.id);
    res.json({ success });
}));

/**
 * DELETE /api/content/playbooks/templates/:id/tags/:tagId
 * Remove tag from playbook template
 */
router.delete('/playbooks/templates/:id/tags/:tagId', authMiddleware, verifyAdmin, asyncHandler(async (req, res) => {
    const success = await AIPlaybookService.removeTemplateTag(req.params.id, req.params.tagId);
    res.json({ success });
}));

// ==========================================
// CATEGORIES
// ==========================================

/**
 * GET /api/content/categories
 * List categories
 */
router.get('/categories', authMiddleware, asyncHandler(async (req, res) => {
    const { contentType, parentId, includeInactive, tree } = req.query;

    if (tree === 'true') {
        const categories = await ContentService.getCategoryTree({
            contentType,
            organizationId: req.user.organizationId,
            includeInactive: includeInactive === 'true'
        });
        return res.json({ categories });
    }

    const categories = await ContentService.listCategories({
        contentType,
        organizationId: req.user.organizationId,
        parentId: parentId === 'null' ? null : parentId,
        includeInactive: includeInactive === 'true'
    });

    res.json({ categories });
}));

/**
 * POST /api/content/categories
 * Create category
 */
router.post('/categories', authMiddleware, verifyAdmin, asyncHandler(async (req, res) => {
    const { name, slug, description, contentType, parentId, sortOrder, color, icon } = req.body;

    const category = await ContentService.createCategory({
        name,
        slug,
        description,
        contentType,
        parentId,
        sortOrder,
        color,
        icon,
        organizationId: req.user.role === 'SUPERADMIN' ? null : req.user.organizationId,
        createdBy: req.user.id
    });

    res.status(201).json({ category });
}));

/**
 * GET /api/content/categories/:id
 * Get category by ID
 */
router.get('/categories/:id', authMiddleware, asyncHandler(async (req, res) => {
    const category = await ContentService.getCategoryById(req.params.id);
    
    if (!category) {
        return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ category });
}));

/**
 * PUT /api/content/categories/:id
 * Update category
 */
router.put('/categories/:id', authMiddleware, verifyAdmin, asyncHandler(async (req, res) => {
    const category = await ContentService.updateCategory(req.params.id, req.body);
    res.json({ category });
}));

/**
 * DELETE /api/content/categories/:id
 * Delete category
 */
router.delete('/categories/:id', authMiddleware, verifySuperAdmin, asyncHandler(async (req, res) => {
    const success = await ContentService.deleteCategory(req.params.id);
    res.json({ success });
}));

// ==========================================
// TAGS
// ==========================================

/**
 * GET /api/content/tags
 * List tags
 */
router.get('/tags', authMiddleware, asyncHandler(async (req, res) => {
    const { contentType, search, includeInactive, sortBy, limit } = req.query;

    const tags = await ContentService.listTags({
        contentType,
        organizationId: req.user.organizationId,
        search,
        includeInactive: includeInactive === 'true',
        sortBy,
        limit: limit ? parseInt(limit) : 100
    });

    res.json({ tags });
}));

/**
 * POST /api/content/tags
 * Create tag
 */
router.post('/tags', authMiddleware, verifyAdmin, asyncHandler(async (req, res) => {
    const { name, slug, contentType, color } = req.body;

    const tag = await ContentService.createTag({
        name,
        slug,
        contentType,
        color,
        organizationId: req.user.role === 'SUPERADMIN' ? null : req.user.organizationId,
        createdBy: req.user.id
    });

    res.status(201).json({ tag });
}));

/**
 * GET /api/content/tags/:id
 * Get tag by ID
 */
router.get('/tags/:id', authMiddleware, asyncHandler(async (req, res) => {
    const tag = await ContentService.getTagById(req.params.id);
    
    if (!tag) {
        return res.status(404).json({ error: 'Tag not found' });
    }

    res.json({ tag });
}));

/**
 * PUT /api/content/tags/:id
 * Update tag
 */
router.put('/tags/:id', authMiddleware, verifyAdmin, asyncHandler(async (req, res) => {
    const tag = await ContentService.updateTag(req.params.id, req.body);
    res.json({ tag });
}));

/**
 * DELETE /api/content/tags/:id
 * Delete tag
 */
router.delete('/tags/:id', authMiddleware, verifySuperAdmin, asyncHandler(async (req, res) => {
    const success = await ContentService.deleteTag(req.params.id);
    res.json({ success });
}));

// ==========================================
// COMMENTS
// ==========================================

/**
 * PUT /api/content/comments/:id
 * Update comment
 */
router.put('/comments/:id', authMiddleware, asyncHandler(async (req, res) => {
    const { commentText } = req.body;
    const comment = await ContentService.updateComment(req.params.id, commentText, req.user.id);
    res.json({ comment });
}));

/**
 * POST /api/content/comments/:id/resolve
 * Resolve comment
 */
router.post('/comments/:id/resolve', authMiddleware, asyncHandler(async (req, res) => {
    const comment = await ContentService.resolveComment(req.params.id, req.user.id);
    res.json({ comment });
}));

/**
 * DELETE /api/content/comments/:id
 * Delete comment
 */
router.delete('/comments/:id', authMiddleware, asyncHandler(async (req, res) => {
    const comment = await ContentService.getCommentById(req.params.id);
    
    if (!comment) {
        return res.status(404).json({ error: 'Comment not found' });
    }

    // Only allow deletion by author or admin
    if (comment.userId !== req.user.id && req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN') {
        return res.status(403).json({ error: 'Cannot delete this comment' });
    }

    const success = await ContentService.deleteComment(req.params.id);
    res.json({ success });
}));

// ==========================================
// REVIEWS
// ==========================================

/**
 * GET /api/content/reviews/pending
 * Get pending reviews for current user
 */
router.get('/reviews/pending', authMiddleware, asyncHandler(async (req, res) => {
    const reviews = await ContentService.getPendingReviews(req.user.id);
    res.json({ reviews });
}));

/**
 * GET /api/content/reviews/:id
 * Get review by ID
 */
router.get('/reviews/:id', authMiddleware, asyncHandler(async (req, res) => {
    const review = await ContentService.getReviewById(req.params.id);
    
    if (!review) {
        return res.status(404).json({ error: 'Review not found' });
    }

    res.json({ review });
}));

/**
 * PUT /api/content/reviews/:id
 * Update review status
 */
router.put('/reviews/:id', authMiddleware, asyncHandler(async (req, res) => {
    const { status, reviewNotes, checklistItems } = req.body;
    const review = await ContentService.updateReviewStatus(req.params.id, status, reviewNotes, checklistItems);
    res.json({ review });
}));

/**
 * POST /api/content/reviews/:id/approve
 * Approve review
 */
router.post('/reviews/:id/approve', authMiddleware, asyncHandler(async (req, res) => {
    const { reviewNotes } = req.body;
    const review = await ContentService.approveReview(req.params.id, reviewNotes);
    res.json({ review });
}));

/**
 * POST /api/content/reviews/:id/reject
 * Reject review
 */
router.post('/reviews/:id/reject', authMiddleware, asyncHandler(async (req, res) => {
    const { reviewNotes } = req.body;
    
    if (!reviewNotes) {
        return res.status(400).json({ error: 'reviewNotes is required for rejection' });
    }

    const review = await ContentService.rejectReview(req.params.id, reviewNotes);
    res.json({ review });
}));

/**
 * POST /api/content/reviews/:id/request-changes
 * Request changes for review
 */
router.post('/reviews/:id/request-changes', authMiddleware, asyncHandler(async (req, res) => {
    const { reviewNotes } = req.body;
    
    if (!reviewNotes) {
        return res.status(400).json({ error: 'reviewNotes is required for requesting changes' });
    }

    const review = await ContentService.requestChanges(req.params.id, reviewNotes);
    res.json({ review });
}));

// ==========================================
// FAVORITES
// ==========================================

/**
 * GET /api/content/favorites
 * Get user favorites
 */
router.get('/favorites', authMiddleware, asyncHandler(async (req, res) => {
    const { contentType, folderName } = req.query;

    const favorites = await ContentService.getUserFavorites(req.user.id, {
        contentType,
        folderName
    });

    res.json({ favorites });
}));

/**
 * POST /api/content/favorites
 * Add to favorites
 */
router.post('/favorites', authMiddleware, asyncHandler(async (req, res) => {
    const { contentId, contentType, notes, folderName } = req.body;

    const favorite = await ContentService.addFavorite(
        req.user.id,
        contentId,
        contentType,
        { notes, folderName }
    );

    res.status(201).json({ favorite });
}));

/**
 * DELETE /api/content/favorites/:contentType/:contentId
 * Remove from favorites
 */
router.delete('/favorites/:contentType/:contentId', authMiddleware, asyncHandler(async (req, res) => {
    const success = await ContentService.removeFavorite(
        req.user.id,
        req.params.contentId,
        req.params.contentType
    );

    res.json({ success });
}));

/**
 * GET /api/content/favorites/check/:contentType/:contentId
 * Check if content is favorited
 */
router.get('/favorites/check/:contentType/:contentId', authMiddleware, asyncHandler(async (req, res) => {
    const isFavorited = await ContentService.isFavorited(
        req.user.id,
        req.params.contentId,
        req.params.contentType
    );

    res.json({ isFavorited });
}));

// ==========================================
// GLOBAL SEARCH
// ==========================================

/**
 * GET /api/content/search
 * Global content search
 */
router.get('/search', authMiddleware, asyncHandler(async (req, res) => {
    const {
        query,
        contentTypes,
        statuses,
        categoryIds,
        tagIds,
        sortBy,
        sortOrder,
        page,
        limit
    } = req.query;

    const results = await ContentService.searchContent({
        query,
        contentTypes: contentTypes ? contentTypes.split(',') : [],
        statuses: statuses ? statuses.split(',') : [],
        categoryIds: categoryIds ? categoryIds.split(',') : [],
        tagIds: tagIds ? tagIds.split(',') : [],
        organizationId: req.user.organizationId,
        sortBy,
        sortOrder,
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20
    });

    res.json(results);
}));

// ==========================================
// ANALYTICS DASHBOARD
// ==========================================

/**
 * GET /api/content/analytics/dashboard
 * Get content analytics dashboard
 */
router.get('/analytics/dashboard', authMiddleware, verifyAdmin, asyncHandler(async (req, res) => {
    const { dateFrom, dateTo } = req.query;

    const dashboard = await ContentService.getAnalyticsDashboard({
        organizationId: req.user.organizationId,
        dateFrom,
        dateTo
    });

    res.json(dashboard);
}));

// ==========================================
// BULK ACTIONS
// ==========================================

/**
 * POST /api/content/bulk-action
 * Perform bulk action on content
 */
router.post('/bulk-action', authMiddleware, verifyAdmin, asyncHandler(async (req, res) => {
    const { action, contentIds, contentType, payload } = req.body;

    if (!contentIds || contentIds.length === 0) {
        return res.status(400).json({ error: 'contentIds required' });
    }

    const results = {
        success: true,
        processed: 0,
        failed: 0,
        errors: []
    };

    for (const contentId of contentIds) {
        try {
            if (contentType === 'EMAIL_TEMPLATE') {
                switch (action) {
                    case 'PUBLISH':
                        await EmailTemplateService.publishTemplate(contentId, req.user.id);
                        break;
                    case 'DEPRECATE':
                        await EmailTemplateService.deprecateTemplate(contentId, req.user.id);
                        break;
                    case 'DELETE':
                        await EmailTemplateService.deleteTemplate(contentId);
                        break;
                    case 'ADD_TAG':
                        await EmailTemplateService.addTag(contentId, payload.tagId, req.user.id);
                        break;
                    case 'REMOVE_TAG':
                        await EmailTemplateService.removeTag(contentId, payload.tagId);
                        break;
                    default:
                        throw new Error(`Unknown action: ${action}`);
                }
            } else if (contentType === 'PLAYBOOK_TEMPLATE') {
                switch (action) {
                    case 'PUBLISH':
                        await AIPlaybookService.publishTemplate(contentId, req.user.id);
                        break;
                    case 'DEPRECATE':
                        await AIPlaybookService.deprecateTemplate(contentId);
                        break;
                    case 'ADD_TAG':
                        await AIPlaybookService.addTemplateTag(contentId, payload.tagId, req.user.id);
                        break;
                    case 'REMOVE_TAG':
                        await AIPlaybookService.removeTemplateTag(contentId, payload.tagId);
                        break;
                    default:
                        throw new Error(`Unknown action: ${action}`);
                }
            }
            results.processed++;
        } catch (err) {
            results.failed++;
            results.errors.push({ contentId, error: err.message });
        }
    }

    results.success = results.failed === 0;
    res.json(results);
}));

// ==========================================
// ERROR HANDLER
// ==========================================

router.use((err, req, res, next) => {
    console.error('[Content API Error]', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        code: err.code
    });
});

export default router;






