import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import type { IDatabase } from '../../database/IDatabase.js';

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

export interface ContentAnalyticsServiceDependencies {
    db: IDatabase;
    uuidv4: () => string;
}

export class ContentAnalyticsService {
    private deps: ContentAnalyticsServiceDependencies;

    constructor(deps?: Partial<ContentAnalyticsServiceDependencies>) {
        this.deps = {
            db: deps?.db ?? getDatabase(),
            uuidv4: deps?.uuidv4 ?? uuidv4,
        };
    }

    async logAnalyticsEvent(data: LogAnalyticsEventData): Promise<AnalyticsEvent> {
        const {
            contentId,
            contentType,
            eventType,
            userId = null,
            organizationId = null,
            metadata = {},
            sessionId = null,
            durationMs = null,
        } = data;

        const id = `ca-${this.deps.uuidv4()}`;
        const now = new Date().toISOString();

        await this.deps.db.run(
            `INSERT INTO content_analytics (
                id, content_id, content_type, event_type, user_id, organization_id,
                metadata, session_id, duration_ms, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                contentId,
                contentType,
                eventType,
                userId,
                organizationId,
                JSON.stringify(metadata),
                sessionId,
                durationMs,
                now,
            ],
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
            createdAt: now,
        };
    }

    async getContentAnalytics(
        contentId: string,
        contentType: string,
        options: GetContentAnalyticsOptions = {},
    ): Promise<ContentAnalytics> {
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

        const stats = (await this.deps.db.get<{
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
            params,
        )) as {
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
            lastInteraction: stats?.last_interaction,
        };
    }

    async getAnalyticsDashboard(
        _options: { organizationId?: string | null; dateFrom?: string | null; dateTo?: string | null } = {},
    ): Promise<AnalyticsDashboard> {
        // Note: Logic copied from ContentService, supports dashboard aggregation
        // Uses subqueries to count from various tables.
        // Requires those tables to exist.
        // If extracted, we assume they exist in the DB.

        const totals = (await this.deps.db.get<{
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
            [],
        )) as {
            published_playbooks: number;
            total_playbooks: number;
            published_emails: number;
            total_emails: number;
            total_categories: number;
            total_tags: number;
        } | null;

        const playbookStats = (await this.deps.db.get<{
            total_runs: number;
            completed_runs: number;
            failed_runs: number;
        }>(
            `SELECT 
                COUNT(*) as total_runs,
                SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_runs,
                SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_runs
             FROM ai_playbook_runs`,
            [],
        )) as {
            total_runs: number;
            completed_runs: number;
            failed_runs: number;
        } | null;

        const emailStats = (await this.deps.db.get<{
            total_sends: number;
            opened: number;
            clicked: number;
        }>(
            `SELECT 
                COUNT(*) as total_sends,
                SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
                SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked
             FROM email_sends`,
            [],
        )) as {
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
            avgEmailClickRate: totalSends > 0 ? Math.round((clicked / totalSends) * 100) : 0,
        };
    }
}
