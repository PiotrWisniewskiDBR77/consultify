import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { TestDatabaseFactory } from '../../../../../../tests/utils/TestDatabaseFactory.js';
import type { IDatabase } from '../../../../../src/database/IDatabase.js';
import { ContentAnalyticsService } from '../../../../../src/services/content/ContentAnalyticsService.js';

describe('ContentAnalyticsService', () => {
    let service: ContentAnalyticsService;
    let db: any;

    beforeEach(async () => {
        const testDb = await TestDatabaseFactory.create();

        // Initialize schema for all related tables needed for dashboard
        await testDb.exec(`
            CREATE TABLE IF NOT EXISTS content_analytics (
                id TEXT PRIMARY KEY,
                content_id TEXT,
                content_type TEXT,
                event_type TEXT,
                user_id TEXT,
                organization_id TEXT,
                metadata TEXT,
                session_id TEXT,
                duration_ms INTEGER,
                created_at TEXT
            );

            CREATE TABLE IF NOT EXISTS ai_playbook_templates (id TEXT, status TEXT);
            CREATE TABLE IF NOT EXISTS email_templates (id TEXT, status TEXT);
            CREATE TABLE IF NOT EXISTS content_categories (id TEXT, is_active INTEGER);
            CREATE TABLE IF NOT EXISTS content_tags (id TEXT, is_active INTEGER);
            
            CREATE TABLE IF NOT EXISTS ai_playbook_runs (id TEXT, status TEXT);
            CREATE TABLE IF NOT EXISTS email_sends (id TEXT, opened_at TEXT, clicked_at TEXT);
        `);

        db = {
            ...testDb,
            run: testDb.runAsync.bind(testDb),
            get: testDb.getAsync.bind(testDb),
            all: testDb.allAsync.bind(testDb),
            exec: (sql: string, cb?: any) => testDb.exec(sql, cb),
            close: () => testDb.close(),
        };

        service = new ContentAnalyticsService({ db: db as IDatabase });
    });

    afterEach(async () => {
        if (db) await db.close();
    });

    describe('logAnalyticsEvent', () => {
        it('should log an event', async () => {
            const data = {
                contentId: 'doc-1',
                contentType: 'DOCUMENT',
                eventType: 'VIEW',
                userId: 'u1',
                metadata: { browser: 'chrome' },
            };

            const event = await service.logAnalyticsEvent(data);

            expect(event.id).toMatch(/^ca-/);
            expect(event.contentId).toBe(data.contentId);
            expect(event.eventType).toBe('VIEW');
            expect(event.createdAt).toBeDefined();

            // Verify db
            const stats = await service.getContentAnalytics('doc-1', 'DOCUMENT');
            expect(stats.totalEvents).toBe(1);
            expect(stats.views).toBe(1);
        });
    });

    describe('getContentAnalytics', () => {
        it('should aggregate events correctly', async () => {
            await service.logAnalyticsEvent({ contentId: 'd1', contentType: 'DOC', eventType: 'VIEW', userId: 'u1' });
            await service.logAnalyticsEvent({ contentId: 'd1', contentType: 'DOC', eventType: 'VIEW', userId: 'u2' });
            await service.logAnalyticsEvent({ contentId: 'd1', contentType: 'DOC', eventType: 'EDIT', userId: 'u1' });
            await service.logAnalyticsEvent({ contentId: 'd1', contentType: 'DOC', eventType: 'EXPORT', userId: 'u1' });

            const stats = await service.getContentAnalytics('d1', 'DOC');

            expect(stats.totalEvents).toBe(4);
            expect(stats.uniqueUsers).toBe(2);
            expect(stats.views).toBe(2);
            expect(stats.edits).toBe(1);
            expect(stats.exports).toBe(1);
            expect(stats.uses).toBe(0);
        });
    });

    describe('getAnalyticsDashboard', () => {
        it('should return aggregated dashboard data', async () => {
            // Seed tables
            await db.exec(`
                INSERT INTO ai_playbook_templates (id, status) VALUES ('1', 'PUBLISHED'), ('2', 'DRAFT');
                INSERT INTO email_templates (id, status) VALUES ('1', 'PUBLISHED');
                INSERT INTO content_categories (id, is_active) VALUES ('1', 1), ('2', 1), ('3', 0);
                INSERT INTO content_tags (id, is_active) VALUES ('1', 1);
                
                INSERT INTO ai_playbook_runs (id, status) VALUES ('1', 'COMPLETED'), ('2', 'FAILED'), ('3', 'COMPLETED');
                INSERT INTO email_sends (id, opened_at, clicked_at) VALUES ('1', '2023-01-01', NULL), ('2', '2023-01-01', '2023-01-01'), ('3', NULL, NULL); 
            `);

            const dashboard = await service.getAnalyticsDashboard();

            expect(dashboard.publishedPlaybooks).toBe(1);
            expect(dashboard.totalPlaybookTemplates).toBe(2);
            expect(dashboard.publishedEmails).toBe(1);
            expect(dashboard.totalEmailTemplates).toBe(1);
            expect(dashboard.totalCategories).toBe(2); // Active only
            expect(dashboard.totalTags).toBe(1); // Active only

            expect(dashboard.totalPlaybookRuns).toBe(3);
            // Success rate: 2 completed / 3 total = 66.6% -> 67%
            expect(dashboard.avgPlaybookSuccessRate).toBe(67);

            expect(dashboard.totalEmailsSent).toBe(3);
            // Open rate: 2 opened / 3 total = 67%
            expect(dashboard.avgEmailOpenRate).toBe(67);
            // Click rate: 1 clicked / 3 total = 33%
            expect(dashboard.avgEmailClickRate).toBe(33);
        });
    });
});
