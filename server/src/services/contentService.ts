/**
 * Content Service
 * Shared functionality for Content Module: categories, tags, comments, reviews,
 * analytics, favorites, and permissions.
 *
 * Part of Content Module Enterprise Extension
 *
 * Fully migrated from server/services/contentService.js to TypeScript
 * Refactored to Facade pattern delegating to specific services.
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import _logger from '../utils/Logger.js';
import { CategoryService } from './content/CategoryService.js';
import { CommentService } from './content/CommentService.js';
import { ContentAnalyticsService } from './content/ContentAnalyticsService.js';
import { ContentSearchService } from './content/ContentSearchService.js';
import { FavoriteService } from './content/FavoriteService.js';
import { ReviewService } from './content/ReviewService.js';
import { TagService } from './content/TagService.js';

// Re-export types
export * from './content/CategoryService.js';
export * from './content/CommentService.js';
export * from './content/ContentAnalyticsService.js';
export * from './content/ContentSearchService.js';
export * from './content/FavoriteService.js';
export * from './content/ReviewService.js';
export * from './content/TagService.js';

// Constants
export const CONTENT_TYPES = {
    PLAYBOOK_TEMPLATE: 'PLAYBOOK_TEMPLATE',
    EMAIL_TEMPLATE: 'EMAIL_TEMPLATE',
    CATEGORY: 'CATEGORY',
} as const;

// Types specific to facade or legacy?
// Most types are exported from services.

export interface ContentServiceDependencies {
    db: IDatabase;
    uuidv4: () => string;
}

export class ContentService {
    private deps: ContentServiceDependencies;

    // Sub-services
    public categoryService: CategoryService;
    public tagService: TagService;
    public commentService: CommentService;
    public reviewService: ReviewService;
    public analyticsService: ContentAnalyticsService;
    public favoriteService: FavoriteService;
    public searchService: ContentSearchService;

    constructor(deps?: Partial<ContentServiceDependencies>) {
        this.deps = {
            db: deps?.db ?? getDatabase(),
            uuidv4: deps?.uuidv4 ?? uuidv4,
        };

        const serviceDeps = { db: this.deps.db, uuidv4: this.deps.uuidv4 };

        this.categoryService = new CategoryService(serviceDeps);
        this.tagService = new TagService(serviceDeps);
        this.commentService = new CommentService(serviceDeps);
        this.reviewService = new ReviewService(serviceDeps);
        this.analyticsService = new ContentAnalyticsService(serviceDeps);
        this.favoriteService = new FavoriteService(serviceDeps);
        this.searchService = new ContentSearchService({ db: this.deps.db });
    }

    // ==========================================
    // CATEGORIES
    // ==========================================

    async createCategory(data: import('./content/CategoryService.js').CreateCategoryData) {
        return this.categoryService.createCategory(data);
    }

    async getCategoryById(id: string) {
        return this.categoryService.getCategoryById(id);
    }

    async listCategories(contentType: string) {
        return this.categoryService.listCategories({ contentType });
    }

    async updateCategory(id: string, updates: Partial<import('./content/CategoryService.js').CategoryRecord>) {
        return this.categoryService.updateCategory(id, updates);
    }

    async deleteCategory(id: string) {
        return this.categoryService.deleteCategory(id);
    }

    // ==========================================
    // TAGS
    // ==========================================

    async createTag(data: import('./content/TagService.js').CreateTagData) {
        return this.tagService.createTag(data);
    }

    async getTagById(id: string) {
        return this.tagService.getTagById(id);
    }

    async listTags(params: import('./content/TagService.js').ListTagsParams = {}) {
        return this.tagService.listTags(params);
    }

    async updateTag(id: string, updates: Partial<import('./content/TagService.js').Tag>) {
        return this.tagService.updateTag(id, updates);
    }

    async deleteTag(id: string) {
        return this.tagService.deleteTag(id);
    }

    async getContentTags(contentId: string, contentType: string) {
        return this.tagService.getContentTags(contentId, contentType);
    }

    async addTagToContent(contentId: string, contentType: string, tagId: string) {
        return this.tagService.addTagToContent(contentId, contentType, tagId);
    }

    async removeTagFromContent(contentId: string, contentType: string, tagId: string) {
        return this.tagService.removeTagFromContent(contentId, contentType, tagId);
    }

    // ==========================================
    // COMMENTS
    // ==========================================

    async createComment(data: import('./content/CommentService.js').CreateCommentData) {
        return this.commentService.createComment(data);
    }

    async getCommentById(id: string) {
        return this.commentService.getCommentById(id);
    }

    async getContentComments(
        contentId: string,
        contentType: string,
        options?: import('./content/CommentService.js').GetContentCommentsOptions,
    ) {
        return this.commentService.getContentComments(contentId, contentType, options);
    }

    async updateComment(id: string, commentText: string, userId: string) {
        return this.commentService.updateComment(id, commentText, userId);
    }

    async resolveComment(id: string, userId: string) {
        return this.commentService.resolveComment(id, userId);
    }

    async deleteComment(id: string) {
        return this.commentService.deleteComment(id);
    }

    // ==========================================
    // REVIEWS
    // ==========================================

    async createReview(data: import('./content/ReviewService.js').CreateReviewData) {
        return this.reviewService.createReview(data);
    }

    async getReviewById(id: string) {
        return this.reviewService.getReviewById(id);
    }

    async getContentReviews(contentId: string, contentType: string) {
        return this.reviewService.getContentReviews(contentId, contentType);
    }

    async getPendingReviews(reviewerId: string) {
        return this.reviewService.getPendingReviews(reviewerId);
    }

    async updateReviewStatus(
        id: string,
        status: string,
        reviewNotes?: string | null,
        checklistItems?: unknown[] | null,
    ) {
        return this.reviewService.updateReviewStatus(id, status, reviewNotes, checklistItems);
    }

    async approveReview(reviewId: string, reviewNotes?: string | null) {
        return this.reviewService.approveReview(reviewId, reviewNotes);
    }

    async rejectReview(reviewId: string, reviewNotes: string) {
        return this.reviewService.rejectReview(reviewId, reviewNotes);
    }

    async requestChanges(reviewId: string, reviewNotes: string) {
        return this.reviewService.requestChanges(reviewId, reviewNotes);
    }

    // ==========================================
    // FAVORITES
    // ==========================================

    async addFavorite(
        userId: string,
        contentId: string,
        contentType: string,
        options?: import('./content/FavoriteService.js').AddFavoriteOptions,
    ) {
        return this.favoriteService.addFavorite(userId, contentId, contentType, options);
    }

    async removeFavorite(userId: string, contentId: string, contentType: string) {
        return this.favoriteService.removeFavorite(userId, contentId, contentType);
    }

    async getUserFavorites(userId: string, options?: import('./content/FavoriteService.js').GetUserFavoritesOptions) {
        return this.favoriteService.getUserFavorites(userId, options);
    }

    async isFavorited(userId: string, contentId: string, contentType: string) {
        return this.favoriteService.isFavorited(userId, contentId, contentType);
    }

    // ==========================================
    // ANALYTICS
    // ==========================================

    async logAnalyticsEvent(data: import('./content/ContentAnalyticsService.js').LogAnalyticsEventData) {
        return this.analyticsService.logAnalyticsEvent(data);
    }

    async getContentAnalytics(
        contentId: string,
        contentType: string,
        options?: import('./content/ContentAnalyticsService.js').GetContentAnalyticsOptions,
    ) {
        return this.analyticsService.getContentAnalytics(contentId, contentType, options);
    }

    async getAnalyticsDashboard(options?: {
        organizationId?: string | null;
        dateFrom?: string | null;
        dateTo?: string | null;
    }) {
        return this.analyticsService.getAnalyticsDashboard(options);
    }

    // ==========================================
    // SEARCH
    // ==========================================

    async searchContent(options?: import('./content/ContentSearchService.js').SearchContentOptions) {
        return this.searchService.searchContent(options);
    }
}

// Export singleton
export const contentServiceInstance = new ContentService();

// Export individual methods for backward compatibility (delegating to singleton)
export const createCategory = (data: any) => contentServiceInstance.createCategory(data);
export const getCategoryById = (id: string) => contentServiceInstance.getCategoryById(id);
export const listCategories = (contentType: string) => contentServiceInstance.listCategories(contentType);
export const updateCategory = (id: string, updates: any) => contentServiceInstance.updateCategory(id, updates);
export const deleteCategory = (id: string) => contentServiceInstance.deleteCategory(id);

export const createTag = (data: any) => contentServiceInstance.createTag(data);
export const getTagById = (id: string) => contentServiceInstance.getTagById(id);
export const listTags = (params: any) => contentServiceInstance.listTags(params);
export const updateTag = (id: string, updates: any) => contentServiceInstance.updateTag(id, updates);
export const deleteTag = (id: string) => contentServiceInstance.deleteTag(id);
export const getContentTags = (contentId: string, contentType: string) =>
    contentServiceInstance.getContentTags(contentId, contentType);
export const addTagToContent = (contentId: string, contentType: string, tagId: string) =>
    contentServiceInstance.addTagToContent(contentId, contentType, tagId);
export const removeTagFromContent = (contentId: string, contentType: string, tagId: string) =>
    contentServiceInstance.removeTagFromContent(contentId, contentType, tagId);

export const createComment = (data: any) => contentServiceInstance.createComment(data);
export const getCommentById = (id: string) => contentServiceInstance.getCommentById(id);
export const getContentComments = (contentId: string, contentType: string, options: any) =>
    contentServiceInstance.getContentComments(contentId, contentType, options);
export const updateComment = (id: string, text: string, userId: string) =>
    contentServiceInstance.updateComment(id, text, userId);
export const resolveComment = (id: string, userId: string) => contentServiceInstance.resolveComment(id, userId);
export const deleteComment = (id: string) => contentServiceInstance.deleteComment(id);

export const createReview = (data: any) => contentServiceInstance.createReview(data);
export const getReviewById = (id: string) => contentServiceInstance.getReviewById(id);
export const getContentReviews = (id: string, type: string) => contentServiceInstance.getContentReviews(id, type);
export const getPendingReviews = (id: string) => contentServiceInstance.getPendingReviews(id);
export const updateReviewStatus = (id: string, status: string, notes?: string | null, check?: unknown[] | null) =>
    contentServiceInstance.updateReviewStatus(id, status, notes, check);
export const approveReview = (id: string, notes?: string | null) => contentServiceInstance.approveReview(id, notes);
export const rejectReview = (id: string, notes: string) => contentServiceInstance.rejectReview(id, notes);
export const requestChanges = (id: string, notes: string) => contentServiceInstance.requestChanges(id, notes);

export const addFavorite = (userId: string, contentId: string, contentType: string, options?: any) =>
    contentServiceInstance.addFavorite(userId, contentId, contentType, options);
export const removeFavorite = (userId: string, contentId: string, contentType: string) =>
    contentServiceInstance.removeFavorite(userId, contentId, contentType);
export const getUserFavorites = (userId: string, options?: any) =>
    contentServiceInstance.getUserFavorites(userId, options);
export const isFavorited = (userId: string, contentId: string, contentType: string) =>
    contentServiceInstance.isFavorited(userId, contentId, contentType);

export const logAnalyticsEvent = (data: any) => contentServiceInstance.logAnalyticsEvent(data);
export const getContentAnalytics = (contentId: string, contentType: string, options?: any) =>
    contentServiceInstance.getContentAnalytics(contentId, contentType, options);
export const getAnalyticsDashboard = (options?: any) => contentServiceInstance.getAnalyticsDashboard(options);

export const searchContent = (options?: any) => contentServiceInstance.searchContent(options);

export default contentServiceInstance;
