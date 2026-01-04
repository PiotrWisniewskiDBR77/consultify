export default ContentService;
declare namespace ContentService {
    export { CONTENT_TYPES };
    export { REVIEW_STATUSES };
    export { REVIEW_PRIORITIES };
    export function createCategory({ name, slug, description, contentType, parentId, sortOrder, color, icon, organizationId, createdBy }: Object): Promise<Object>;
    export function getCategoryById(id: string): Promise<Object | null>;
    export function listCategories({ contentType, organizationId, parentId, includeInactive }?: Object): Promise<any[]>;
    export function updateCategory(id: string, updates: Object): Promise<Object>;
    export function deleteCategory(id: string): Promise<boolean>;
    export function getCategoryTree(options?: Object): Promise<any[]>;
    export function createTag({ name, slug, contentType, color, organizationId, createdBy }: Object): Promise<Object>;
    export function getTagById(id: string): Promise<Object | null>;
    export function listTags({ contentType, organizationId, search, includeInactive, sortBy, limit }?: Object): Promise<any[]>;
    export function updateTag(id: string, updates: Object): Promise<Object>;
    export function deleteTag(id: string): Promise<boolean>;
    export function getContentTags(contentId: string, contentType: string): Promise<any[]>;
    export function addTagToContent(contentId: string, contentType: string, tagId: string, userId?: string): Promise<boolean>;
    export function removeTagFromContent(contentId: string, contentType: string, tagId: string): Promise<boolean>;
    export function createComment({ contentId, contentType, userId, commentText, parentCommentId, positionRef, mentionedUserIds }: Object): Promise<Object>;
    export function getCommentById(id: string): Promise<Object | null>;
    export function getContentComments(contentId: string, contentType: string, { includeResolved }?: Object): Promise<any[]>;
    export function updateComment(id: string, commentText: string, userId: string): Promise<Object>;
    export function resolveComment(id: string, userId: string): Promise<Object>;
    export function deleteComment(id: string): Promise<boolean>;
    export function createReview({ contentId, contentType, requestedBy, reviewerId, priority, dueDate, checklistItems, versionAtReview }: Object): Promise<Object>;
    export function getReviewById(id: string): Promise<Object | null>;
    export function getContentReviews(contentId: string, contentType: string): Promise<any[]>;
    export function getPendingReviews(reviewerId: string): Promise<any[]>;
    export function updateReviewStatus(id: string, status: string, reviewNotes?: string, checklistItems?: any[]): Promise<Object>;
    export function approveReview(reviewId: string, reviewNotes?: string): Promise<Object>;
    export function rejectReview(reviewId: string, reviewNotes: string): Promise<Object>;
    export function requestChanges(reviewId: string, reviewNotes: string): Promise<Object>;
    export function addFavorite(userId: string, contentId: string, contentType: string, { notes, folderName }?: Object): Promise<Object>;
    export function removeFavorite(userId: string, contentId: string, contentType: string): Promise<boolean>;
    export function getUserFavorites(userId: string, { contentType, folderName }?: Object): Promise<any[]>;
    export function isFavorited(userId: string, contentId: string, contentType: string): Promise<boolean>;
    export function logAnalyticsEvent({ contentId, contentType, eventType, userId, organizationId, metadata, sessionId, durationMs }: Object): Promise<Object>;
    export function getContentAnalytics(contentId: string, contentType: string, { dateFrom, dateTo }?: Object): Promise<Object>;
    export function getAnalyticsDashboard({ organizationId, dateFrom, dateTo }?: Object): Promise<Object>;
    export function searchContent({ query, contentTypes, statuses, categoryIds, tagIds, organizationId, sortBy, sortOrder, page, limit }: Object): Promise<Object>;
    export function _mapCategoryRow(row: any): {
        id: any;
        name: any;
        slug: any;
        description: any;
        contentType: any;
        parentId: any;
        sortOrder: any;
        color: any;
        icon: any;
        organizationId: any;
        isActive: boolean;
        createdAt: any;
        updatedAt: any;
        createdBy: any;
    };
    export function _mapTagRow(row: any): {
        id: any;
        name: any;
        slug: any;
        contentType: any;
        color: any;
        organizationId: any;
        usageCount: any;
        isActive: boolean;
        createdAt: any;
        createdBy: any;
    };
    export function _mapCommentRow(row: any): {
        id: any;
        contentId: any;
        contentType: any;
        userId: any;
        commentText: any;
        parentCommentId: any;
        threadId: any;
        positionRef: any;
        isResolved: boolean;
        resolvedBy: any;
        resolvedAt: any;
        mentionedUserIds: any;
        isEdited: boolean;
        editedAt: any;
        createdAt: any;
        updatedAt: any;
        user: {
            id: any;
            firstName: any;
            lastName: any;
            avatar: any;
        } | null;
    };
    export function _mapReviewRow(row: any): {
        id: any;
        contentId: any;
        contentType: any;
        requestedBy: any;
        requestedAt: any;
        reviewerId: any;
        status: any;
        reviewNotes: any;
        checklistItems: any;
        reviewedAt: any;
        versionAtReview: any;
        priority: any;
        dueDate: any;
        createdAt: any;
        updatedAt: any;
        requester: {
            id: any;
            firstName: any;
            lastName: any;
        } | null;
        reviewer: {
            id: any;
            firstName: any;
            lastName: any;
        } | null;
    };
    export function _camelToSnake(str: any): any;
}
declare namespace CONTENT_TYPES {
    let PLAYBOOK_TEMPLATE: string;
    let EMAIL_TEMPLATE: string;
    let CATEGORY: string;
}
declare namespace REVIEW_STATUSES {
    let PENDING: string;
    let IN_REVIEW: string;
    let APPROVED: string;
    let REJECTED: string;
    let CHANGES_REQUESTED: string;
}
declare namespace REVIEW_PRIORITIES {
    let LOW: string;
    let NORMAL: string;
    let HIGH: string;
    let URGENT: string;
}
//# sourceMappingURL=contentService.d.ts.map