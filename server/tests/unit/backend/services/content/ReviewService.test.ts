import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { TestDatabaseFactory } from '../../../../../../tests/utils/TestDatabaseFactory.js';
import type { IDatabase } from '../../../../../src/database/IDatabase.js';
import {
  REVIEW_STATUSES,
  ReviewService,
} from '../../../../../src/services/content/ReviewService.js';

describe('ReviewService', () => {
  let service: ReviewService;
  let db: any;

  beforeEach(async () => {
    const testDb = await TestDatabaseFactory.create();

    // Initialize schema
    await testDb.exec(`
             CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                first_name TEXT,
                last_name TEXT,
                avatar_url TEXT
            );

            CREATE TABLE IF NOT EXISTS content_reviews (
                id TEXT PRIMARY KEY,
                content_id TEXT NOT NULL,
                content_type TEXT NOT NULL,
                requested_by TEXT NOT NULL,
                requested_at TEXT NOT NULL,
                reviewer_id TEXT NOT NULL,
                status TEXT DEFAULT 'PENDING',
                review_notes TEXT,
                checklist_items TEXT,
                version_at_review TEXT,
                priority TEXT DEFAULT 'NORMAL',
                due_date TEXT,
                reviewed_at TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (requested_by) REFERENCES users(id),
                FOREIGN KEY (reviewer_id) REFERENCES users(id)
            );
            
            -- Seed users
            INSERT INTO users (id, first_name, last_name) VALUES ('u1', 'Requester', 'One');
            INSERT INTO users (id, first_name, last_name) VALUES ('u2', 'Reviewer', 'Two');
        `);

    db = {
      ...testDb,
      run: testDb.runAsync.bind(testDb),
      get: testDb.getAsync.bind(testDb),
      all: testDb.allAsync.bind(testDb),
      exec: (sql: string, cb?: any) => testDb.exec(sql, cb),
      close: () => testDb.close(),
    };

    service = new ReviewService({ db: db as IDatabase });
  });

  afterEach(async () => {
    if (db) await db.close();
  });

  describe('createReview', () => {
    it('should create a review request', async () => {
      const data = {
        contentId: 'doc-1',
        contentType: 'DOCUMENT',
        requestedBy: 'u1',
        reviewerId: 'u2',
        priority: 'HIGH' as const,
        checklistItems: ['Check A', 'Check B'],
      };

      const review = await service.createReview(data);

      expect(review.id).toMatch(/^rev-/);
      expect(review.status).toBe(REVIEW_STATUSES.PENDING);
      expect(review.priority).toBe('HIGH');
      expect(review.checklistItems).toEqual(['Check A', 'Check B']);
      expect(review.requester?.firstName).toBe('Requester');
      expect(review.reviewer?.lastName).toBe('Two');
    });
  });

  describe('getPendingReviews', () => {
    it('should return pending reviews for reviewer', async () => {
      const data = {
        contentId: 'doc-1',
        contentType: 'DOCUMENT',
        requestedBy: 'u1',
        reviewerId: 'u2',
        priority: 'NORMAL' as const,
      };
      await service.createReview(data);

      const pending = await service.getPendingReviews('u2');
      expect(pending).toHaveLength(1);
    });

    it('should not return approved reviews', async () => {
      const review = await service.createReview({
        contentId: 'doc-1',
        contentType: 'DOCUMENT',
        requestedBy: 'u1',
        reviewerId: 'u2',
      });

      await service.approveReview(review.id);

      const pending = await service.getPendingReviews('u2');
      expect(pending).toHaveLength(0);
    });
  });

  describe('workflow', () => {
    it('should approve review', async () => {
      const review = await service.createReview({
        contentId: 'doc-1',
        contentType: 'DOCUMENT',
        requestedBy: 'u1',
        reviewerId: 'u2',
      });

      const approved = await service.approveReview(review.id, 'LGTM');
      expect(approved.status).toBe(REVIEW_STATUSES.APPROVED);
      expect(approved.reviewNotes).toBe('LGTM');
      expect(approved.reviewedAt).toBeDefined();
    });

    it('should reject review', async () => {
      const review = await service.createReview({
        contentId: 'doc-1',
        contentType: 'DOCUMENT',
        requestedBy: 'u1',
        reviewerId: 'u2',
      });

      const rejected = await service.rejectReview(review.id, 'Bad code');
      expect(rejected.status).toBe(REVIEW_STATUSES.REJECTED);
      expect(rejected.reviewNotes).toBe('Bad code');
    });
  });
});
