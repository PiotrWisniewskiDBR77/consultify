import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import type { IDatabase } from '../../database/IDatabase.js';

export const REVIEW_STATUSES = {
    PENDING: 'PENDING',
    IN_REVIEW: 'IN_REVIEW',
    CHANGES_REQUESTED: 'CHANGES_REQUESTED',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
} as const;

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
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    dueDate?: string | null;
    checklistItems?: unknown[];
    versionAtReview?: string | null;
}

export interface ReviewServiceDependencies {
    db: IDatabase;
    uuidv4: () => string;
}

export class ReviewService {
    private deps: ReviewServiceDependencies;

    constructor(deps?: Partial<ReviewServiceDependencies>) {
        this.deps = {
            db: deps?.db ?? getDatabase(),
            uuidv4: deps?.uuidv4 ?? uuidv4,
        };
    }

    async createReview(data: CreateReviewData): Promise<Review> {
        const {
            contentId,
            contentType,
            requestedBy,
            reviewerId,
            priority = 'NORMAL',
            dueDate = null,
            checklistItems = [],
            versionAtReview = null,
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
                id,
                contentId,
                contentType,
                requestedBy,
                now,
                reviewerId,
                JSON.stringify(checklistItems),
                versionAtReview,
                priority,
                dueDate,
                now,
                now,
            ],
        );

        const created = await this.getReviewById(id);
        if (!created) {
            throw new Error('Failed to retrieve created review');
        }
        return created;
    }

    async getReviewById(id: string): Promise<Review | null> {
        const row = (await this.deps.db.get<ReviewRecord>(
            `SELECT cr.*,
                req.first_name as requester_first_name, req.last_name as requester_last_name,
                rev.first_name as reviewer_first_name, rev.last_name as reviewer_last_name
             FROM content_reviews cr
             LEFT JOIN users req ON cr.requested_by = req.id
             LEFT JOIN users rev ON cr.reviewer_id = rev.id
             WHERE cr.id = ?`,
            [id],
        )) as ReviewRecord | null;

        if (!row) return null;
        return this._mapReviewRow(row);
    }

    async getContentReviews(contentId: string, contentType: string): Promise<Review[]> {
        const rows = (await this.deps.db.all<ReviewRecord>(
            `SELECT cr.*,
                req.first_name as requester_first_name, req.last_name as requester_last_name,
                rev.first_name as reviewer_first_name, rev.last_name as reviewer_last_name
             FROM content_reviews cr
             LEFT JOIN users req ON cr.requested_by = req.id
             LEFT JOIN users rev ON cr.reviewer_id = rev.id
             WHERE cr.content_id = ? AND cr.content_type = ?
             ORDER BY cr.created_at DESC`,
            [contentId, contentType],
        )) as ReviewRecord[];

        return (rows || []).map((row) => this._mapReviewRow(row));
    }

    async getPendingReviews(reviewerId: string): Promise<Review[]> {
        const rows = (await this.deps.db.all<ReviewRecord>(
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
        )) as ReviewRecord[];

        return (rows || []).map((row) => this._mapReviewRow(row));
    }

    async updateReviewStatus(
        id: string,
        status: string,
        reviewNotes: string | null = null,
        checklistItems: unknown[] | null = null,
    ): Promise<Review> {
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

        if (
            status === REVIEW_STATUSES.APPROVED ||
            status === REVIEW_STATUSES.REJECTED ||
            status === REVIEW_STATUSES.CHANGES_REQUESTED
        ) {
            setClauses.push('reviewed_at = ?');
            values.push(now);
        }

        values.push(id);

        const result = (await this.deps.db.run(
            `UPDATE content_reviews SET ${setClauses.join(', ')} WHERE id = ?`,
            values,
        )) as unknown as { changes?: number }; // Safe casting if IDatabase varies, but effectively RunResult

        if (result && result.changes === 0) {
            // throw new Error(`Review ${id} not found`);
            // Actually, if we want to be strict.
            // For now let's just proceed to fetch.
        }

        const updated = await this.getReviewById(id);
        if (!updated) {
            throw new Error('Review not found'); // If fetch fails, it really doesn't exist
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

    private _mapReviewRow(row: ReviewRecord): Review {
        return {
            id: row.id,
            contentId: row.content_id,
            contentType: row.content_type,
            requestedBy: row.requested_by,
            requestedAt: row.requested_at,
            reviewerId: row.reviewer_id,
            status: row.status,
            reviewNotes: row.review_notes ?? null,
            checklistItems: row.checklist_items ? (JSON.parse(row.checklist_items) as unknown[]) : [],
            reviewedAt: row.reviewed_at ?? null,
            versionAtReview: row.version_at_review ?? null,
            priority: row.priority,
            dueDate: row.due_date ?? null,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            requester: row.requester_first_name
                ? {
                      id: row.requested_by,
                      firstName: row.requester_first_name,
                      lastName: row.requester_last_name || '',
                  }
                : null,
            reviewer: row.reviewer_first_name
                ? {
                      id: row.reviewer_id,
                      firstName: row.reviewer_first_name,
                      lastName: row.reviewer_last_name || '',
                  }
                : null,
        };
    }
}
